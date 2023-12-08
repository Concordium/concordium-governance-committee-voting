use anyhow::Context;
use axum::{
    extract::{Path, State},
    http::{Method, StatusCode},
    routing::get,
    Json, Router,
};
use clap::Parser;
use concordium_rust_sdk::{
    smart_contracts::common::AccountAddress, types::hashes::TransactionHash,
};
use election_server::db::{DatabasePool, StoredBallotSubmission};
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
    /// The request timeout of the http server
    #[clap(
        long = "request-timeout",
        default_value_t = 5000,
        env = "CCD_ELECTION_REQUEST_TIMEOUT"
    )]
    request_timeout:      u64,
    /// Address the http server will listen on
    #[clap(
        long = "listen-address",
        default_value = "0.0.0.0:8080",
        env = "CCD_ELECTION_LISTEN_ADDRESS"
    )]
    listen_address:       std::net::SocketAddr,
    /// A json file consisting of the list of eligible voters and their
    /// respective voting weights
    #[clap(
        long = "eligible-voters-file",
        env = "CCD_ELECTION_ELIGIBLE_VOTERS_FILE"
    )]
    eligible_voters_file: String,
    /// Path to the directory where frontend assets are located
    #[clap(
        long = "frontend-dir",
        default_value = "./frontend/dist",
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
}

/// The app state shared across http requests made to the server.
#[derive(Clone, Debug)]
struct AppState {
    /// The DB connection pool from.
    db_pool: DatabasePool,
}

/// Get ballot submissions registered for `account_address`. Returns
/// [`StatusCode`] signaling error if database connection or lookup fails.
#[tracing::instrument(skip(state))]
async fn get_ballot_submissions_by_account(
    State(state): State<AppState>,
    Path(account_address): Path<AccountAddress>,
) -> Result<Json<Vec<StoredBallotSubmission>>, StatusCode> {
    let db = state.db_pool.get().await.map_err(|e| {
        tracing::error!("Could not get db connection from pool: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let ballot_submissions = db
        .get_ballot_submissions(account_address)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get ballot submissions for account: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Json(ballot_submissions))
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
    Ok(Json(ballot_submission))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = AppConfig::parse();

    {
        use tracing_subscriber::prelude::*;
        let log_filter = tracing_subscriber::filter::Targets::new()
            .with_target(module_path!(), config.log_level)
            .with_target("tower_http", config.log_level);

        tracing_subscriber::registry()
            .with(tracing_subscriber::fmt::layer())
            .with(log_filter)
            .init();
    }

    let state = AppState {
        db_pool: DatabasePool::create(config.db_connection, config.pool_size, true)
            .await
            .context("Failed to connect to the database")?,
    };
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_origin(Any);
    let timeout = config.request_timeout;

    let mut router = Router::new()
        .route_service("/", ServeFile::new(config.frontend_dir.join("index.html")))
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
            "/static/eligible-voters.json",
            ServeFile::new(config.eligible_voters_file),
        )
         // Fall back to serving anything from the frontend dir
        .route_service("/*path", ServeDir::new(config.frontend_dir))
        .layer(
            tower_http::trace::TraceLayer::new_for_http()
                .make_span_with(tower_http::trace::DefaultMakeSpan::new())
                .on_response(tower_http::trace::DefaultOnResponse::new()),
        )
        .layer(tower_http::timeout::TimeoutLayer::new(
            std::time::Duration::from_millis(timeout),
        ))
        .layer(tower_http::limit::RequestBodyLimitLayer::new(1_000_000)) // at most 1000kB of data.
        .layer(tower_http::compression::CompressionLayer::new());

    if config.allow_cors {
        router = router.layer(cors);
    }

    let listener = tokio::net::TcpListener::bind(config.listen_address)
        .await
        .with_context(|| {
            format!(
                "Could not create tcp listener on address: {}",
                &config.listen_address
            )
        })?;

    tracing::info!("Listening for requests at {}", config.listen_address);
    axum::serve(listener, router)
        .await
        .context("HTTP server has shut down")?;
    Ok(())
}