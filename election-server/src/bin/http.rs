use anyhow::Context;
use axum::Router;
use clap::Parser;
use election_server::db::{Database, DatabasePool};


/// Command line configuration of the application.
#[derive(Debug, Parser, Clone)]
struct AppConfig {
    /// The node used for querying
    #[arg(
        long = "node",
        help = "The endpoints are expected to point to concordium node grpc v2 API's.",
        default_value = "http://localhost:20001",
        env = "CCD_ELECTION_NODE",
    )]
    node_endpoint:   concordium_rust_sdk::v2::Endpoint,
    /// Database connection string.
    #[arg(
        long = "db-connection",
        default_value = "host=localhost dbname=gc-election user=postgres password=password \
                         port=5432",
        help = "A connection string detailing the connection to the database used by the \
                application.",
        env = "CCD_ELECTION_DB_CONNECTION"
    )]
    db_connection:    tokio_postgres::config::Config,
    /// Maximum size of the database connection pool
    #[clap(
        long = "db-pool-size",
        default_value = "16",
        env = "CCD_ELECTION_DB_POOL_SIZE"
    )]
    pool_size:            usize,
    /// Maximum log level
    #[clap(
        long = "log-level",
        default_value = "info",
        env = "CCD_ELECTION_LOG_LEVEL"
    )]
    log_level:        tracing_subscriber::filter::LevelFilter,
    /// The request timeout of the http server
    #[clap(
        long = "request-timeout",
        default_value = "5000",
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
}

#[derive(Clone)]
struct AppState {
    db_pool: DatabasePool
}

async fn get_ballot_submission() {}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = AppConfig::parse();

    {
        use tracing_subscriber::prelude::*;
        let log_filter = tracing_subscriber::filter::Targets::new()
            .with_target(module_path!(), args.log_level)
            .with_target("tower_http", args.log_level);

        tracing_subscriber::registry()
            .with(tracing_subscriber::fmt::layer())
            .with(log_filter)
            .init();
    }

    tracing::info!("Service started with configuration: {:?}", args);

    let timeout = args.request_timeout;
    let listener = tokio::net::TcpListener::bind(args.listen_address).await.with_context(|| format!("Could not create tcp listener on address: {}", &args.listen_address))?;

    let state = AppState {
        db_pool: DatabasePool::create(args.db_connection, args.pool_size).context("Failed to connect to the database")?
    };

    let router = Router::new()
        .with_state(state)
        .layer(
            tower_http::trace::TraceLayer::new_for_http()
                .make_span_with(tower_http::trace::DefaultMakeSpan::new())
                .on_response(tower_http::trace::DefaultOnResponse::new()),
        )
        .layer(tower_http::timeout::TimeoutLayer::new(
            std::time::Duration::from_millis(timeout),
        ))
        .layer(tower_http::limit::RequestBodyLimitLayer::new(1_000_000)); // at most 1000kB of data.

    axum::serve(listener, router).await.context("HTTP server has shut down")?;
    Ok(())
}
