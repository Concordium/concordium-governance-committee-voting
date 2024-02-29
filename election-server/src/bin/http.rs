use anyhow::Context;
use axum::{
    extract::{Path, Query, State},
    http::{Method, StatusCode},
    response::Html,
    routing::get,
    Json, Router,
};
use axum_prometheus::{
    metrics_exporter_prometheus::PrometheusHandle, GenericMetricLayer, PrometheusMetricLayerBuilder,
};
use clap::Parser;
use concordium_governance_committee_election::ElectionConfig;
use concordium_rust_sdk::{
    smart_contracts::common::AccountAddress,
    types::{hashes::TransactionHash, ContractAddress},
};
use concordium_std::Amount;
use election_common::{get_scaling_factor, WeightRow};
use election_server::{
    db::{DatabasePool, StoredBallotSubmission, StoredDelegation},
    util::{create_client, get_election_config, verify_checksum, verify_contract},
};
use futures::FutureExt;
use handlebars::{no_escape, Handlebars};
use serde::{Deserialize, Serialize};
use std::{cmp, collections::HashMap};
use tower_http::{
    cors::{Any, CorsLayer},
    services::{ServeDir, ServeFile},
};

/// Command line configuration of the application.
#[derive(Debug, Parser, Clone)]
struct AppConfig {
    /// The node used for querying
    #[arg(
        long = "node",
        help = "The endpoint is expected to point to concordium node grpc v2 API's. The endpoint \
                is built into the frontend served, which means the node must enable grpc-web to \
                be used successfully.",
        default_value = "https://grpc.testnet.concordium.com:20000",
        env = "CCD_ELECTION_NODE"
    )]
    node_endpoint:        concordium_rust_sdk::v2::Endpoint,
    /// Database connection string.
    #[arg(
        long = "db-connection",
        default_value = "host=localhost dbname=gc-election user=postgres password=password \
                         port=5432",
        help = "A connection string detailing the connection to the database used by the \
                application.",
        env = "CCD_ELECTION_DB_CONNECTION"
    )]
    db_connection:        tokio_postgres::config::Config,
    /// Maximum size of the database connection pool
    #[clap(
        long = "db-pool-size",
        default_value_t = 16,
        env = "CCD_ELECTION_DB_POOL_SIZE"
    )]
    pool_size:            usize,
    /// Maximum log level
    #[clap(
        long = "log-level",
        default_value = "info",
        env = "CCD_ELECTION_LOG_LEVEL"
    )]
    log_level:            tracing_subscriber::filter::LevelFilter,
    /// The request timeout of the http server (in milliseconds)
    #[clap(
        long = "request-timeout-ms",
        default_value_t = 5000,
        env = "CCD_ELECTION_REQUEST_TIMEOUT_MS"
    )]
    request_timeout_ms:   u64,
    /// Address the http server will listen on
    #[clap(
        long = "listen-address",
        default_value = "0.0.0.0:8080",
        env = "CCD_ELECTION_LISTEN_ADDRESS"
    )]
    listen_address:       std::net::SocketAddr,
    /// Address of the prometheus server
    #[clap(long = "prometheus-address", env = "CCD_ELECTION_PROMETHEUS_ADDRESS")]
    prometheus_address:   Option<std::net::SocketAddr>,
    /// A csv file consisting of the list of eligible voters and their
    /// respective voting weights
    #[clap(
        long = "eligible-voters-file",
        default_value = "../resources/config-example/initial-weights.csv",
        env = "CCD_ELECTION_ELIGIBLE_VOTERS_FILE"
    )]
    eligible_voters_file: std::path::PathBuf,
    /// A json file consisting of the election manifest used by election guard
    #[clap(
        long = "election-manifest-file",
        default_value = "../resources/config-example/election-manifest.json",
        env = "CCD_ELECTION_ELECTION_MANIFEST_FILE"
    )]
    eg_manifest_file:     std::path::PathBuf,
    /// A json file consisting of the election parameters used by election guard
    #[clap(
        long = "election-parameters-file",
        default_value = "../resources/config-example/election-parameters.json",
        env = "CCD_ELECTION_ELECTION_PARAMETERS_FILE"
    )]
    eg_parameters_file:   std::path::PathBuf,
    /// Path to the directory where frontend assets are located
    #[clap(
        long = "frontend-dir",
        default_value = "../apps/voting/dist",
        env = "CCD_ELECTION_FRONTEND_DIR"
    )]
    frontend_dir:         std::path::PathBuf,
    /// Allow requests from other origins. Useful for development where frontend
    /// is not served from the server.
    #[clap(
        long = "allow-cors",
        default_value_t = false,
        env = "CCD_ELECTION_ALLOW_CORS"
    )]
    allow_cors:           bool,
    /// The network to connect users to (passed to frontend).
    #[clap(
        long = "network",
        env = "CCD_ELECTION_NETWORK",
        default_value_t = concordium_rust_sdk::web3id::did::Network::Testnet,
        help = "The network to connect users to (passed to frontend). Possible values: testnet, mainnet"
    )]
    network:              concordium_rust_sdk::web3id::did::Network,
    /// The contract address of the election contract (passed to frontend)
    #[clap(long = "contract-address", env = "CCD_ELECTION_CONTRACT_ADDRESS")]
    contract_address:     ContractAddress,
}

impl AppConfig {
    /// Creates the JSON object required by the frontend.
    fn as_frontend_config(&self) -> serde_json::Value {
        let config = serde_json::json!({
            "node": self.node_endpoint.uri().to_string(),
            "network": self.network,
            "contractAddress": self.contract_address
        });
        let config_string =
            serde_json::to_string(&config).expect("JSON serialization always succeeds");
        serde_json::json!({ "config": config_string })
    }

    /// Deserializes the election guard config files. The supplied [`Client`] is
    /// used to verify the files match the checksum registered in the
    /// election contract.
    fn verify_config_files(&self, contract_config: &ElectionConfig) -> Result<(), anyhow::Error> {
        verify_checksum(
            &self.eg_manifest_file,
            contract_config.election_manifest.hash.0,
        )?;
        verify_checksum(
            &self.eg_parameters_file,
            contract_config.election_parameters.hash.0,
        )?;
        verify_checksum(
            &self.eligible_voters_file,
            contract_config.eligible_voters.hash.0,
        )?;
        Ok(())
    }
}

/// The app state shared across http requests made to the server.
#[derive(Clone, Debug)]
struct AppState {
    /// The DB connection pool from.
    db_pool:         DatabasePool,
    /// The computed initial weights of each eligible voter.
    initial_weights: HashMap<AccountAddress, Amount>,
}

const MAX_SUBMISSIONS_PAGE_SIZE: usize = 20;

fn default_page_size() -> usize { MAX_SUBMISSIONS_PAGE_SIZE }

/// query params passed to [`get_ballot_submissions_by_account`].
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct SubmissionsQueryParams {
    /// The page of ballot submissions to get.
    #[serde(default)]
    from:      Option<usize>,
    /// The pagination size used.
    #[serde(default = "default_page_size")]
    page_size: usize,
}

impl SubmissionsQueryParams {
    /// Get the page size, where the max page size is capped by
    /// [`MAX_SUBMISSIONS_PAGE_SIZE`]
    fn page_size(&self) -> usize { cmp::min(self.page_size, MAX_SUBMISSIONS_PAGE_SIZE) }
}

/// The response type for paginated queries
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PaginationResponse<T> {
    /// entries returned in the response
    results:  Vec<T>,
    /// Whether there are more results in the database
    has_more: bool,
}

/// Get ballot submissions registered for `account_address`. Returns
/// [`StatusCode`] signaling error if database connection or lookup fails.
#[tracing::instrument(skip(state))]
async fn get_ballot_submissions_by_account(
    State(state): State<AppState>,
    Path(account_address): Path<AccountAddress>,
    Query(query_params): Query<SubmissionsQueryParams>,
) -> Result<Json<PaginationResponse<StoredBallotSubmission>>, StatusCode> {
    let db = state.db_pool.get().await.map_err(|e| {
        tracing::error!("Could not get db connection from pool: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let page_size = query_params.page_size();
    let mut results = db
        // Add 1 to the page size to identify if there are more results on the next "page"
        .get_ballot_submissions(account_address, query_params.from, page_size + 1)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get ballot submissions for account: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let has_more = results.len() > page_size;
    if has_more {
        // Pop the last item of results, which will be the first item on the next page.
        results.pop();
    }

    let response = PaginationResponse { results, has_more };
    Ok(Json(response))
}

/// Get voting power delegations registered for `account_address`. Returns
/// [`StatusCode`] signaling error if database connection or lookup fails.
#[tracing::instrument(skip(state))]
async fn get_delegations_by_account(
    State(state): State<AppState>,
    Path(account_address): Path<AccountAddress>,
    Query(query_params): Query<SubmissionsQueryParams>,
) -> Result<Json<PaginationResponse<StoredDelegation>>, StatusCode> {
    let db = state.db_pool.get().await.map_err(|e| {
        tracing::error!("Could not get db connection from pool: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let page_size = query_params.page_size();
    let mut results = db
        // Add 1 to the page size to identify if there are more results on the next "page"
        .get_delegations(account_address, query_params.from, page_size + 1)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get delegations for account: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let has_more = results.len() > page_size;
    if has_more {
        // Pop the last item of results, which will be the first item on the next page.
        results.pop();
    }

    let response = PaginationResponse { results, has_more };
    Ok(Json(response))
}

/// Get ballot submission (if any) registered for `transaction_hash`. Returns
/// [`StatusCode`] signaling error if database connection or lookup fails.
#[tracing::instrument(skip(state))]
async fn get_ballot_submission_by_transaction(
    State(state): State<AppState>,
    Path(transaction_hash): Path<TransactionHash>,
) -> Result<Json<Option<StoredBallotSubmission>>, StatusCode> {
    let db = state.db_pool.get().await.map_err(|e| {
        tracing::error!("Could not get db connection from pool: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let ballot_submission = db
        .get_ballot_submission(transaction_hash)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get ballot submission: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let result = ballot_submission.map(StoredBallotSubmission::from);
    Ok(Json(result))
}

/// Get the voting weight of an account address.
#[tracing::instrument(skip(state))]
async fn get_account_weight(
    State(state): State<AppState>,
    Path(account): Path<AccountAddress>,
) -> Json<u64> {
    let amount = state
        .initial_weights
        .get(&account)
        .copied()
        .unwrap_or(Amount::from_micro_ccd(0));
    let weight = get_scaling_factor(&amount);
    Json(weight)
}

type PrometheusLayer = GenericMetricLayer<'static, PrometheusHandle, axum_prometheus::Handle>;

/// Configures the prometheus server (if enabled through [`AppConfig`]). Returns
/// a [`PrometheusLayer`] to be used by the HTTP server, and a handle for the
/// corresponding process spawned.
fn setup_prometheus(
    config: &AppConfig,
) -> (
    PrometheusLayer,
    Option<tokio::task::JoinHandle<Result<(), anyhow::Error>>>,
) {
    let (prometheus_layer, metric_handle) = PrometheusMetricLayerBuilder::new()
        .with_prefix("election-server")
        .with_default_metrics()
        .build_pair();
    let prometheus_handle = if let Some(prometheus_address) = config.prometheus_address {
        let prometheus_api = Router::new()
            .route(
                "/metrics",
                axum::routing::get(|| async move { metric_handle.render() }),
            )
            .layer(tower_http::timeout::TimeoutLayer::new(
                std::time::Duration::from_millis(1000),
            ))
            .layer(tower_http::limit::RequestBodyLimitLayer::new(0));

        Some(tokio::spawn(async move {
            let listener = tokio::net::TcpListener::bind(prometheus_address)
                .await
                .with_context(|| {
                    format!(
                        "Could not create tcp listener on address: {}",
                        prometheus_address
                    )
                })?;
            axum::serve(listener, prometheus_api)
                .await
                .context("Prometheus server has shut down")
        }))
    } else {
        None
    };

    (prometheus_layer, prometheus_handle)
}

/// Configures the HTTP server which serves as an API for election components.
/// Returns a handle for the corresponding process spawned, or an error if
/// configuration fails.
async fn setup_http(
    config: &AppConfig,
    prometheus_layer: PrometheusLayer,
) -> Result<tokio::task::JoinHandle<Result<(), anyhow::Error>>, anyhow::Error> {
    let reader = csv::Reader::from_path(&config.eligible_voters_file)
        .context("Failed to read eligible voters file")?;

    let mut initial_weights = HashMap::new();
    for row in reader.into_deserialize::<WeightRow>() {
        let WeightRow { account, amount } = row.context("Failed to parse eligible voters file")?;
        initial_weights.insert(account, amount);
    }

    let state = AppState {
        db_pool: DatabasePool::create(config.db_connection.clone(), config.pool_size, true)
            .await
            .context("Failed to connect to the database")?,
        initial_weights,
    };
    // Render index.html with config
    let index_template = std::fs::read_to_string(config.frontend_dir.join("index.html"))
        .context("Frontend was not built.")?;
    let mut reg = Handlebars::new();
    // Prevent handlebars from escaping inserted object
    reg.register_escape_fn(no_escape);

    let index_html = reg.render_template(&index_template, &config.as_frontend_config())?;
    let index_handler = get(|| async { Html(index_html) });

    let mut http_api = Router::new()
        .route(
            "/api/submission-status/:transaction",
            get(get_ballot_submission_by_transaction),
        )
        .route(
            "/api/submissions/:account",
            get(get_ballot_submissions_by_account),
        )
        .route("/api/weight/:account", get(get_account_weight))
        .with_state(state)
        .route_service(
            "/static/concordium/eligible-voters.csv",
            ServeFile::new(&config.eligible_voters_file),
        )
        .route_service(
            "/static/electionguard/election-manifest.json",
            ServeFile::new(&config.eg_manifest_file),
        )
        .route_service(
            "/static/electionguard/election-parameters.json",
            ServeFile::new(&config.eg_parameters_file),
        )
        .route("/", index_handler.clone())
        .route("/index.html", index_handler)
         // Fall back to serving anything from the frontend dir
        .route_service("/*path", ServeDir::new(&config.frontend_dir))
        .layer(prometheus_layer)
        .layer(tower_http::timeout::TimeoutLayer::new(
            std::time::Duration::from_millis(config.request_timeout_ms),
        ))
        .layer(
            tower_http::trace::TraceLayer::new_for_http()
                .make_span_with(tower_http::trace::DefaultMakeSpan::new())
                .on_response(tower_http::trace::DefaultOnResponse::new()),
        )
        .layer(tower_http::limit::RequestBodyLimitLayer::new(1_000_000)) // at most 1000kB of data.
        .layer(tower_http::compression::CompressionLayer::new());

    if config.allow_cors {
        let cors = CorsLayer::new()
            .allow_methods([Method::GET, Method::POST])
            .allow_origin(Any);
        http_api = http_api.layer(cors);
    }

    let listen_address = config.listen_address;
    let http_handle = tokio::spawn(async move {
        let listener = tokio::net::TcpListener::bind(listen_address)
            .await
            .with_context(|| {
                format!(
                    "Could not create tcp listener on address: {}",
                    listen_address
                )
            })?;

        tracing::info!("Listening for requests at {}", listen_address);
        axum::serve(listener, http_api)
            .await
            .context("HTTP server has shut down")
    });

    Ok(http_handle)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = AppConfig::parse();

    {
        use tracing_subscriber::prelude::*;
        let log_filter = tracing_subscriber::filter::Targets::new()
            .with_target(module_path!(), config.log_level)
            .with_target("election_server", config.log_level)
            .with_target("tower_http", config.log_level);

        tracing_subscriber::registry()
            .with(tracing_subscriber::fmt::layer())
            .with(log_filter)
            .init();
    }

    // Verify that we serve the files matching what is registered in the contract
    {
        let request_timeout = std::time::Duration::from_millis(config.request_timeout_ms);
        let client = create_client(config.node_endpoint.clone(), request_timeout).await?;
        let mut contract_client = verify_contract(client, config.contract_address).await?;
        let contract_config = get_election_config(&mut contract_client).await?;
        config.verify_config_files(&contract_config)?;
    }

    let (prometheus_layer, prometheus_handle) = setup_prometheus(&config);
    let http_handle = setup_http(&config, prometheus_layer).await?;

    let http_handle = http_handle.map(|res| res.context("Http task panicked"));
    if let Some(prometheus_handle) = prometheus_handle {
        tokio::select! {
            result = prometheus_handle => {
                result.context("Prometheus task panicked")??;
            },
            result = http_handle => {
                result??;
            }
        }
    } else {
        http_handle.await??;
    }

    Ok(())
}
