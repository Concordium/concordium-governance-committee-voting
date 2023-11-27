use clap::Parser;


/// Command line configuration of the application.
#[derive(Debug, Parser)]
struct Args {
    /// The node used for querying
    #[arg(
        long = "node",
        help = "The endpoints are expected to point to concordium node grpc v2 API's.",
        default_value = "http://localhost:20001",
        env = "GC_ELECTION_NODES",
        value_delimiter = ','
    )]
    node_endpoints: Vec<concordium_rust_sdk::v2::Endpoint>,
    /// Database connection string.
    #[arg(
        long = "db-connection",
        default_value = "host=localhost dbname=gc-election user=postgres password=password \
                         port=5432",
        help = "A connection string detailing the connection to the database used by the \
                application.",
        env = "GC_ELECTION_DB_CONNECTION"
    )]
    db_connection:  tokio_postgres::config::Config,
}

fn main() {
    println!("Hello, world!");
}
