use anyhow::Context;
use axum::{
    extract::{Path, Query, State},
    http::{Method, StatusCode},
    routing::get,
    Json, Router, response::Html,
};
use axum_prometheus::{
    metrics_exporter_prometheus::PrometheusHandle, GenericMetricLayer, PrometheusMetricLayerBuilder,
};
use clap::Parser;
use concordium_rust_sdk::{
    smart_contracts::common::AccountAddress,
    types::{hashes::TransactionHash, ContractAddress},
};
use election_server::db::{DatabasePool, StoredBallotSubmission};
use futures::FutureExt;
use handlebars::Handlebars;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{cmp, collections::VecDeque};
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
        help = "The endpoints are expected to point to concordium node grpc v2 API's.",
        default_value = "http://localhost:20001",
        env = "CCD_ELECTION_NODE"
    )]
    node_endpoint: concordium_rust_sdk::v2::Endpoint,
    /// Database connection string.
    #[arg(
        long = "db-connection",
        default_value = "host=localhost dbname=gc-election user=postgres password=password \
                         port=5432",
        help = "A connection string detailing the connection to the database used by the \
                application.",
        env = "CCD_ELECTION_DB_CONNECTION"
    )]
    db_connection: tokio_postgres::config::Config,
    /// Maximum size of the database connection pool
    #[clap(
        long = "db-pool-size",
        default_value_t = 16,
        env = "CCD_ELECTION_DB_POOL_SIZE"
    )]
    pool_size: usize,
    /// Maximum log level
    #[clap(
        long = "log-level",
        default_value = "info",
        env = "CCD_ELECTION_LOG_LEVEL"
    )]
    log_level: tracing_subscriber::filter::LevelFilter,
    /// The request timeout of the http server (in milliseconds)
    #[clap(
        long = "request-timeout-ms",
        default_value_t = 5000,
        env = "CCD_ELECTION_REQUEST_TIMEOUT_MS"
    )]
    request_timeout_ms: u64,
    /// Address the http server will listen on
    #[clap(
        long = "listen-address",
        default_value = "0.0.0.0:8080",
        env = "CCD_ELECTION_LISTEN_ADDRESS"
    )]
    listen_address: std::net::SocketAddr,
    /// Address of the prometheus server
    #[clap(long = "prometheus-address", env = "CCD_ELECTION_PROMETHEUS_ADDRESS")]
    prometheus_address: Option<std::net::SocketAddr>,
    /// A json file consisting of the list of eligible voters and their
    /// respective voting weights
    #[clap(
        long = "eligible-voters-file",
        env = "CCD_ELECTION_ELIGIBLE_VOTERS_FILE"
    )]
    eligible_voters_file: std::path::PathBuf,
    /// A directory containing configuration files for election guard, i.e the election manifest
    /// and the election parameters.
    #[clap(long = "eg-config-dir", env = "CCD_ELECTION_EG_CONFIG_DIR")]
    eg_config_dir: std::path::PathBuf,
    /// Path to the directory where frontend assets are located
    #[clap(
        long = "frontend-dir",
        default_value = "./frontend/dist",
        env = "CCD_ELECTION_FRONTEND_DIR"
    )]
    frontend_dir: std::path::PathBuf,
    /// Allow requests from other origins. Useful for development where frontend
    /// is not served from the server.
    #[clap(
        long = "allow-cors",
        default_value_t = false,
        env = "CCD_ELECTION_ALLOW_CORS"
    )]
    allow_cors: bool,
    /// The network to connect users to (passed to frontend)
    #[clap(long = "network", env = "CCD_ELECTION_NETWORK")]
    network: Network,
    /// The contract address of the election contract (passed to frontend)
    #[clap(long = "contract-address", env = "CCD_ELECTION_CONTRACT_ADDRESS")]
    contract_address: ContractAddress,
}

/// The app state shared across http requests made to the server.
#[derive(Clone, Debug)]
struct AppState {
    /// The DB connection pool from.
    db_pool: DatabasePool,
}

#[derive(Clone, Debug, clap::ValueEnum, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Network {
    Mainnet,
    Testnet,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrontendConfig {
    node: String,
    network: Network,
    contract_address: ContractAddress,
}

impl From<&AppConfig> for FrontendConfig {
    fn from(value: &AppConfig) -> Self {
        Self {
            node: value.node_endpoint.uri().to_string(),
            network: value.network.clone(),
            contract_address: value.contract_address,
        }
    }
}

const MAX_SUBMISSIONS_PAGE_SIZE: usize = 20;

fn default_page_size() -> usize {
    MAX_SUBMISSIONS_PAGE_SIZE
}

/// query params passed to [`get_ballot_submissions_by_account`].
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct SubmissionsQueryParams {
    /// The page of ballot submissions to get.
    #[serde(default)]
    from: Option<usize>,
    /// The pagination size used.
    #[serde(default = "default_page_size")]
    page_size: usize,
}

impl SubmissionsQueryParams {
    /// Get the page size, where the max page size is capped by
    /// [`MAX_SUBMISSIONS_PAGE_SIZE`]
    fn page_size(&self) -> usize {
        cmp::min(self.page_size, MAX_SUBMISSIONS_PAGE_SIZE)
    }
}

/// The response type for [`get_ballot_submissions_by_account`] queries
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SubmissionsResponse {
    /// Ballots returned in the response
    results: Vec<StoredBallotSubmission>,
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
) -> Result<Json<SubmissionsResponse>, StatusCode> {
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

    let has_more = results.len() > query_params.page_size();
    if has_more {
        // Pop the first value of the result, as the query returns values in descending
        // order
        let mut results_deque: VecDeque<_> = results.into();
        results_deque.pop_front();
        results = results_deque.into();
    }

    let response = SubmissionsResponse { results, has_more };
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

type PrometheusLayer = GenericMetricLayer<'static, PrometheusHandle, axum_prometheus::Handle>;

/// Configures the prometheus server (if enabled through [`AppConfig`]). Returns a [`PrometheusLayer`] to be used by the HTTP server, and a handle for the corresponding process spawned.
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
                .context("Prometheus server has shut down")?;
            Ok::<(), anyhow::Error>(())
        }))
    } else {
        None
    };

    (prometheus_layer, prometheus_handle)
}

/// Configures the HTTP server which serves as an API for election components. Returns a handle for
/// the corresponding process spawned, or an error if configuration fails.
async fn setup_http(
    config: &AppConfig,
    prometheus_layer: PrometheusLayer,
) -> Result<tokio::task::JoinHandle<Result<(), anyhow::Error>>, anyhow::Error> {
    let state = AppState {
        db_pool: DatabasePool::create(config.db_connection.clone(), config.pool_size, true)
            .await
            .context("Failed to connect to the database")?,
    };
    let frontend_config: FrontendConfig = config.into();
    
    // Render index.html with config
    let index_template = std::fs::read_to_string(config.frontend_dir.join("index.html"))
        .context("Frontend was not built.")?;
    let mut reg = Handlebars::new();
    // Prevent handlebars from escaping inserted object
    reg.register_escape_fn(|s| s.into());

    let config_string = serde_json::to_string(&frontend_config)?;
    let index_html = reg.render_template(
        &index_template,
        &json!({ "config": config_string }),
    )?;
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
        .with_state(state)
        .route_service(
            "/static/concordium/eligible-voters.json",
            ServeFile::new(config.eligible_voters_file.clone()),
        )
        .nest_service(
            "/static/electionguard",
            ServeDir::new(config.eg_config_dir.clone()),
        )
        .route("/", index_handler.clone())
        .route("/index.html", index_handler.clone())
         // Fall back to serving anything from the frontend dir
        .route_service("/*path", ServeDir::new(config.frontend_dir.clone()))
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
