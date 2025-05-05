use anyhow::Context;
use axum::{
    extract::{Path, Query, State},
    http::{Method, StatusCode},
    response::{Html, Redirect},
    routing::get,
    Json, Router,
};
use axum_prometheus::{
    metrics_exporter_prometheus::PrometheusHandle, GenericMetricLayer, PrometheusMetricLayerBuilder,
};
use chrono::{DateTime, Utc};
use clap::Parser;
use concordium_governance_committee_election::{
    ChecksumUrl, ElectionConfig, GuardianStatus, ViewElectionResultQueryResponse,
};
use concordium_rust_sdk::{
    common::types::{Amount, Timestamp},
    smart_contracts::common::AccountAddress,
    types::{hashes::TransactionHash, ContractAddress},
};
use election_common::{
    contract::{verify_contract, ElectionClient as ElectionContract},
    get_scaling_factor, HttpClient, WeightRow,
};
use election_server::{
    db::{DatabasePool, StoredBallotSubmission, StoredDelegation},
    util::{create_client, get_election_config, get_election_result, get_guardians_state},
};
use futures::FutureExt;
use handlebars::{no_escape, Handlebars};
use serde::{Deserialize, Serialize};
use std::{cmp, collections::HashMap, sync::Arc};
use tokio::sync::Mutex;
use tower_http::{
    cors::{Any, CorsLayer},
    services::ServeDir,
};

/// Command line configuration of the application.
#[derive(Debug, Parser, Clone)]
#[clap(version, author)]
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
    node_endpoint:      concordium_rust_sdk::v2::Endpoint,
    /// Database connection string.
    #[arg(
        long = "db-connection",
        default_value = "host=localhost dbname=gc-election user=postgres password=password \
                         port=5432",
        help = "A connection string detailing the connection to the database used by the \
                application.",
        env = "CCD_ELECTION_DB_CONNECTION"
    )]
    db_connection:      tokio_postgres::config::Config,
    /// Maximum size of the database connection pool
    #[clap(
        long = "db-pool-size",
        default_value_t = 16,
        env = "CCD_ELECTION_DB_POOL_SIZE"
    )]
    pool_size:          usize,
    /// Maximum log level
    #[clap(
        long = "log-level",
        default_value = "info",
        env = "CCD_ELECTION_LOG_LEVEL"
    )]
    log_level:          tracing_subscriber::filter::LevelFilter,
    /// The request timeout of the http server (in milliseconds)
    #[clap(
        long = "request-timeout-ms",
        default_value_t = 10000,
        env = "CCD_ELECTION_REQUEST_TIMEOUT_MS"
    )]
    request_timeout_ms: u64,
    /// Address the http server will listen on
    #[clap(
        long = "listen-address",
        default_value = "0.0.0.0:8080",
        env = "CCD_ELECTION_LISTEN_ADDRESS"
    )]
    listen_address:     std::net::SocketAddr,
    /// Address of the prometheus server
    #[clap(long = "prometheus-address", env = "CCD_ELECTION_PROMETHEUS_ADDRESS")]
    prometheus_address: Option<std::net::SocketAddr>,
    /// Path to the directory where frontend assets are located
    #[clap(
        long = "frontend-dir",
        default_value = "../apps/voting/dist",
        env = "CCD_ELECTION_FRONTEND_DIR"
    )]
    frontend_dir:       std::path::PathBuf,
    /// Allow requests from other origins. Useful for development where frontend
    /// is not served from the server.
    #[clap(
        long = "allow-cors",
        default_value_t = false,
        env = "CCD_ELECTION_ALLOW_CORS"
    )]
    allow_cors:         bool,
    /// The network to connect users to (passed to frontend).
    #[clap(
        long = "network",
        env = "CCD_ELECTION_NETWORK",
        default_value_t = concordium_rust_sdk::web3id::did::Network::Testnet,
        help = "The network to connect users to (passed to frontend). Possible values: testnet, mainnet"
    )]
    network:            concordium_rust_sdk::web3id::did::Network,
    /// The contract address of the election contract (passed to frontend)
    #[clap(long = "contract-address", env = "CCD_ELECTION_CONTRACT_ADDRESS")]
    contract_address:   ContractAddress,
}

/// The necessary configuration from the election contract from the perspective
/// of the frontend application
#[derive(serde::Serialize, Debug)]
struct FrontendElectionConfig {
    /// A url to the location of the election manifest used by election guard.
    election_manifest:    ChecksumUrl,
    /// A url to the location of the election parameters used by election guard.
    election_parameters:  ChecksumUrl,
    /// A list of candidates that voters can vote for in the election.
    candidates:           Vec<ChecksumUrl>,
    /// A description of the election, e.g. "Concordium GC election, June 2024".
    election_description: String,
    /// The start time of the election, marking the time from which votes can be
    /// registered.
    election_start:       Timestamp,
    /// The end time of the election, marking the time at which votes can no
    /// longer be registered.
    election_end:         Timestamp,
    /// Whether the setup process has been successfully completed by all
    /// guardians.
    guardians_setup_done: bool,
    /// The public keys of all guardians
    guardian_keys:        Option<Vec<Vec<u8>>>,
    /// The election result
    election_result:      ViewElectionResultQueryResponse,
}

impl FrontendElectionConfig {
    /// Create a frontend configuration from an [`ElectionConfig`], setting the
    /// remaining fields to their default values.
    fn create(election_config: ElectionConfig) -> Self {
        Self {
            election_manifest:    election_config.election_manifest,
            election_parameters:  election_config.election_parameters,
            candidates:           election_config.candidates,
            election_description: election_config.election_description,
            election_start:       election_config.election_start,
            election_end:         election_config.election_end,
            guardians_setup_done: Default::default(),
            guardian_keys:        Default::default(),
            election_result:      Default::default(),
        }
    }
}

/// The configuration expected in the frontend application
#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct FrontendConfig {
    /// The node used to communicate with the chain
    node:             String,
    /// The network used in the application
    network:          concordium_rust_sdk::web3id::did::Network,
    /// The contract address of the election contract
    contract_address: ContractAddress,
    /// The necessary configuration from the election contract
    contract_config:  FrontendElectionConfig,
}

impl FrontendConfig {
    /// Creates a new configuration struct for the frontend application
    fn create(app_config: &AppConfig, contract_config: &ElectionConfig) -> Self {
        Self {
            node:             app_config.node_endpoint.uri().to_string(),
            network:          app_config.network,
            contract_address: app_config.contract_address,
            contract_config:  FrontendElectionConfig::create(contract_config.clone()),
        }
    }
}

/// A cache for [`Html`] responses for corresponding [`ElectionPhase`]s
#[derive(Debug)]
struct FrontendCache {
    /// The template used to generate a response
    html_template: String,
    /// Cache for [`ElectionPhase::Setup`]
    setup_html:    Option<Html<String>>,
    /// Cache for [`ElectionPhase::Voting`]
    voting_html:   Option<Html<String>>,
    /// Cache for [`ElectionPhase::Tally`]
    tally_html:    Option<Html<String>>,
}

impl FrontendCache {
    /// Construct a new cache
    fn new(html_template: String) -> Self {
        Self {
            html_template,
            setup_html: Default::default(),
            voting_html: Default::default(),
            tally_html: Default::default(),
        }
    }

    /// Get the item corresponding to the passed [`ElectionPhase`]
    fn get(&self, election_phase: ElectionPhase) -> Option<Html<String>> {
        match election_phase {
            ElectionPhase::Setup => self.setup_html.clone(),
            ElectionPhase::Voting => self.voting_html.clone(),
            ElectionPhase::Tally => self.tally_html.clone(),
        }
    }

    /// Render a response corresponding to the passed [`ElectionPhase`]. The
    /// response produced is stored in the cache for subsequent use.
    fn render(
        &mut self,
        election_phase: ElectionPhase,
        fe_config: &FrontendConfig,
    ) -> Result<Html<String>, StatusCode> {
        let mut hbs = Handlebars::new();
        // Prevent handlebars from escaping inserted object
        hbs.register_escape_fn(no_escape);
        let fe_config_string =
            serde_json::to_string(&fe_config).expect("JSON serialization always succeeds");
        let html = hbs
            .render_template(
                &self.html_template,
                &serde_json::json!({ "config": fe_config_string }),
            )
            .map(Html)
            .map_err(|e| {
                tracing::error!("Failed to render template: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

        match election_phase {
            ElectionPhase::Setup => {
                self.setup_html = Some(html.clone());
            }
            ElectionPhase::Voting => {
                self.voting_html = Some(html.clone());
            }
            ElectionPhase::Tally => {
                self.tally_html = Some(html.clone());
            }
        };

        Ok(html)
    }
}

/// The different phases of the election
#[derive(PartialEq, Clone, Copy, Debug)]
enum ElectionPhase {
    /// The voting window of the election is not yet active. Guardians perform
    /// key generation.
    Setup,
    /// The voting window of the election is active. Voters can submit election
    /// ballots.
    Voting,
    /// The voting window of the election has passed. The election result is
    /// computed and published.
    Tally,
}

/// The frontend state shared across app requests made to the server.
#[derive(Clone, Debug)]
struct FrontendState {
    /// The application config, required to generated the [`FrontendConfig`]
    /// used.
    app_config:      AppConfig,
    /// A cache holding a possible response per [`ElectionPhase`].
    frontend_cache:  Arc<Mutex<FrontendCache>>,
    /// The election config from the election contract
    contract_config: ElectionConfig,
    /// A contract client for the election contract
    contract_client: ElectionContract,
}

impl FrontendState {
    fn get_election_phase(&self) -> ElectionPhase {
        let now = chrono::offset::Utc::now().timestamp_millis() as u64;
        if now < self.contract_config.election_start.millis {
            return ElectionPhase::Setup;
        }
        if now < self.contract_config.election_end.millis {
            return ElectionPhase::Voting;
        }
        ElectionPhase::Tally
    }
}

/// The api state shared across api requests made to the server.
#[derive(Clone, Debug)]
struct ApiState {
    /// The DB connection pool from.
    db_pool:         DatabasePool,
    /// The computed initial weights of each eligible voter.
    initial_weights: HashMap<AccountAddress, Amount>,
}

impl ApiState {
    /// Gets the initial weight computed for the `account`.
    fn get_account_initial_weight(&self, account: &AccountAddress) -> u64 {
        let amount = self
            .initial_weights
            .get(account)
            .copied()
            .unwrap_or(Amount::from_micro_ccd(0));
        get_scaling_factor(&amount)
    }
}

const MAX_SUBMISSIONS_PAGE_SIZE: usize = 20;

fn default_page_size() -> usize { MAX_SUBMISSIONS_PAGE_SIZE }

/// query params passed to [`get_ballot_submissions_by_account`].
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct PaginatedQueryParams {
    /// The page of ballot submissions to get.
    #[serde(default)]
    from:      Option<usize>,
    /// The pagination size used.
    #[serde(default = "default_page_size")]
    page_size: usize,
}

impl PaginatedQueryParams {
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
    State(state): State<ApiState>,
    Path(account_address): Path<AccountAddress>,
    Query(query_params): Query<PaginatedQueryParams>,
) -> Result<Json<PaginationResponse<StoredBallotSubmission>>, StatusCode> {
    let db = state.db_pool.get().await.map_err(|e| {
        tracing::error!("Could not get db connection from pool: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let page_size = query_params.page_size();
    let mut results = db
        // Add 1 to the page size to identify if there are more results on the next "page"
        .get_ballot_submissions(&account_address, query_params.from, page_size + 1)
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

/// Describes each row returned in [`get_delegations_by_account`]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DelegationResponseRow {
    /// The index of the ballot submission in the database
    pub id:               u64,
    /// The transaction hash of the ballot submission
    pub transaction_hash: TransactionHash,
    /// The timestamp of the block the ballot submission was included in
    pub block_time:       DateTime<Utc>,
    /// The delegator account
    pub from_account:     AccountAddress,
    /// The delegatee account
    pub to_account:       AccountAddress,
    /// The delegated weight
    pub weight:           u64,
}

impl DelegationResponseRow {
    /// Creates a [`DelegationResponseRow`] from a [`StoredDelegation`] and an
    /// associated account weight
    fn create(db_delegation: StoredDelegation, weight: u64) -> Self {
        Self {
            id: db_delegation.id,
            transaction_hash: db_delegation.transaction_hash,
            block_time: db_delegation.block_time,
            from_account: db_delegation.from_account,
            to_account: db_delegation.to_account,
            weight,
        }
    }
}

/// Get voting weight delegations registered for `account_address`. Returns
/// [`StatusCode`] signaling error if database connection or lookup fails.
#[tracing::instrument(skip(state))]
async fn get_delegations_by_account(
    State(state): State<ApiState>,
    Path(account_address): Path<AccountAddress>,
    Query(query_params): Query<PaginatedQueryParams>,
) -> Result<Json<PaginationResponse<DelegationResponseRow>>, StatusCode> {
    let db = state.db_pool.get().await.map_err(|e| {
        tracing::error!("Could not get db connection from pool: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let page_size = query_params.page_size();
    let mut results = db
        // Add 1 to the page size to identify if there are more results on the next "page"
        .get_delegations(&account_address, query_params.from, page_size + 1)
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

    let results = results
        .into_iter()
        .map(|del| {
            let weight = state.get_account_initial_weight(&del.from_account);
            DelegationResponseRow::create(del, weight)
        })
        .collect();

    let response = PaginationResponse { results, has_more };
    Ok(Json(response))
}

/// Get ballot submission (if any) registered for `transaction_hash`. Returns
/// [`StatusCode`] signaling error if database connection or lookup fails.
#[tracing::instrument(skip(state))]
async fn get_ballot_submission_by_transaction(
    State(state): State<ApiState>,
    Path(transaction_hash): Path<TransactionHash>,
) -> Result<Json<Option<StoredBallotSubmission>>, StatusCode> {
    let db = state.db_pool.get().await.map_err(|e| {
        tracing::error!("Could not get db connection from pool: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let ballot_submission = db
        .get_ballot_submission(&transaction_hash)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get ballot submission: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let result = ballot_submission.map(StoredBallotSubmission::from);
    Ok(Json(result))
}

/// Renders the frontend application from the [`FrontendCache`]. If the response
/// is not already in the cache for the calculated [`ElectionPhase`], a new
/// response is produced and cached for subsequent requests to use.
#[tracing::instrument(skip(state))]
async fn get_index_html(
    State(mut state): State<FrontendState>,
) -> Result<Html<String>, StatusCode> {
    let mut cache = state.frontend_cache.lock().await;
    let mut election_phase = state.get_election_phase();
    if let Some(html) = cache.get(election_phase) {
        tracing::debug!(r#"Cache hit for election phase "{:?}""#, election_phase);
        return Ok(html.clone());
    }

    let mut fe_config = FrontendConfig::create(&state.app_config, &state.contract_config);
    if election_phase == ElectionPhase::Tally {
        let election_result = get_election_result(&mut state.contract_client)
            .await
            .map_err(|e| {
                tracing::error!("{}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

        // If the result is not there yet, get the voting representation
        if election_result.is_none() {
            tracing::debug!("No election result found, using voting phase cache");
            election_phase = ElectionPhase::Voting;
            if let Some(html) = cache.get(election_phase) {
                return Ok(html);
            }
        } else {
            fe_config.contract_config.election_result = election_result;
        }
    }

    if election_phase != ElectionPhase::Setup {
        let guardians_state = get_guardians_state(&mut state.contract_client)
            .await
            .map_err(|e| {
                tracing::error!("{}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        let setup_done = guardians_state.iter().all(|(_, g)| {
            g.public_key.is_some()
                && g.encrypted_share.is_some()
                && g.status
                    .clone()
                    .map(|s| matches!(s, GuardianStatus::VerificationSuccessful))
                    .unwrap_or(false)
        });
        let guardian_keys = guardians_state
            .iter()
            .map(|(_, g)| g.public_key.clone())
            .collect();

        fe_config.contract_config.guardians_setup_done = setup_done;
        fe_config.contract_config.guardian_keys = guardian_keys;
    }

    cache.render(election_phase, &fe_config)
}

/// The response format of [`get_account_weight`]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AccountWeightResponse {
    /// The initial voting weight calculated for the account queried
    voting_weight:    u64,
    /// Delegation made to another account from the queried account
    delegated_to:     Option<AccountAddress>,
    /// Delegations from other accounts made to the account queried
    delegations_from: PaginationResponse<(AccountAddress, u64)>,
}

/// The number of delegations returned in
/// [`AccountWeightResponse::delegations_from`]
const NUM_DELEGATIONS_FROM: usize = 3;

/// Get the voting weight of an account address.
#[tracing::instrument(skip(state))]
async fn get_account_weight(
    State(state): State<ApiState>,
    Path(account): Path<AccountAddress>,
) -> Result<Json<AccountWeightResponse>, StatusCode> {
    let db = state.db_pool.get().await.map_err(|e| {
        tracing::error!("Could not get db connection from pool: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let delegated_to = db
        .get_delegation_out(&account)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get delegations: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .map(|d| d.to_account);
    let mut results = db
        .get_n_delegations_in(&account, NUM_DELEGATIONS_FROM + 1)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get delegations: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let has_more = results.len() > NUM_DELEGATIONS_FROM;
    if has_more {
        // Pop the last item of results, which will be the first item on the next page.
        results.pop();
    }

    let results = results
        .into_iter()
        .map(|del| {
            let weight = state.get_account_initial_weight(&del.from_account);
            (del.from_account, weight)
        })
        .collect();

    let delegations_from = PaginationResponse { results, has_more };
    let response = AccountWeightResponse {
        voting_weight: state.get_account_initial_weight(&account),
        delegated_to,
        delegations_from,
    };

    Ok(Json(response))
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
    let request_timeout = std::time::Duration::from_millis(config.request_timeout_ms);
    let client = create_client(config.node_endpoint.clone(), request_timeout).await?;
    let mut contract_client = verify_contract(client, config.contract_address).await?;
    let contract_config = get_election_config(&mut contract_client).await?;
    let initial_weights = HttpClient::try_create(config.request_timeout_ms)?
        .get_resource_checked(&contract_config.eligible_voters.data)
        .await?;

    let reader = csv::Reader::from_reader(std::io::Cursor::new(initial_weights));
    let mut initial_weights = HashMap::new();
    for row in reader.into_deserialize::<WeightRow>() {
        let WeightRow { account, amount } = row.context("Failed to parse eligible voters file")?;
        initial_weights.insert(account, amount);
    }

    let index_template = std::fs::read_to_string(config.frontend_dir.join("index.html"))
        .context("Frontend was not built.")?;
    let api_state = ApiState {
        db_pool: DatabasePool::create(config.db_connection.clone(), config.pool_size, true)
            .await
            .context("Failed to connect to the database")?,
        initial_weights,
    };

    let fe_state = FrontendState {
        app_config: config.clone(),
        frontend_cache: Arc::new(Mutex::new(FrontendCache::new(index_template))),
        contract_config,
        contract_client,
    };

    let mut http_api = Router::new()
        .route(
            "/api/submission-status/:transaction",
            get(get_ballot_submission_by_transaction),
        )
        .route(
            "/api/submissions/:account",
            get(get_ballot_submissions_by_account),
        )
        .route("/api/delegations/:account", get(get_delegations_by_account))
        .route("/api/weight/:account", get(get_account_weight))
        .with_state(api_state)
        // Serve everything frontend-related
        .route_service("/assets/*path", ServeDir::new(&config.frontend_dir))
         // Fall back to handle route in the frontend of the application served
        .route("/index.html", get(|| async { Redirect::permanent("/")}))
        .fallback(get(get_index_html))
        .with_state(fe_state);

    // Add layers
    http_api = http_api
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

    tracing::info!(
        "Starting election server version {}, {}",
        env!("CARGO_PKG_VERSION"),
        &config.contract_address
    );

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
