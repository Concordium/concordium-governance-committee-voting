use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use anyhow::{anyhow, Context};
use chrono::{DateTime, Utc};
use clap::Parser;
use concordium_governance_committee_election::RegisterVotesParameter;
use concordium_rust_sdk::{
    smart_contracts::common as contracts_common,
    types::{
        hashes::{BlockHash, TransactionHash},
        smart_contracts::InstanceInfo,
        AbsoluteBlockHeight, BlockItemSummary, ContractAddress, ExecutionTree, ExecutionTreeV1,
    },
    v2::{BlockIdentifier, Client, Endpoint},
};
use futures::{future, TryStreamExt};
use serde::Serialize;
use tokio::task::JoinHandle;
use tokio_postgres::types::{Json, ToSql};

const REGISTER_VOTES_RECEIVE: &str = "ccd_gc_election.registerVotes";

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
    node_endpoints:   Vec<concordium_rust_sdk::v2::Endpoint>,
    /// Database connection string.
    #[arg(
        long = "db-connection",
        default_value = "host=localhost dbname=gc-election user=postgres password=password \
                         port=5432",
        help = "A connection string detailing the connection to the database used by the \
                application.",
        env = "GC_ELECTION_DB_CONNECTION"
    )]
    db_connection:    tokio_postgres::config::Config,
    /// The contract address used to filter contract updates
    #[arg(long = "contract-address", env = "GC_ELECTION_DB_CONNECTION")]
    contract_address: ContractAddress,
    /// The absolute block height to start indexing ballot submissions from
    #[arg(long = "from-height", env = "GC_ELECTION_FROM_HEIGHT")]
    from_height:      Option<AbsoluteBlockHeight>,
    /// Maximum log level
    #[clap(
        long = "log-level",
        default_value = "info",
        env = "GC_ELECTION_LOG_LEVEL"
    )]
    log_level:            tracing_subscriber::filter::LevelFilter,
    /// Max amount of seconds a response from a node can fall behind before
    /// trying another.
    #[arg(
        long = "max-behind-seconds",
        default_value_t = 240,
        env = "KPI_TRACKER_MAX_BEHIND_SECONDS"
    )]
    max_behind_s:     u32,
}

/// Describes an election ballot submission
#[derive(Serialize, Debug)]
struct BallotSubmission {
    /// The account which submitted the ballot
    account:          contracts_common::AccountAddress,
    /// The ballot submitted
    ballot:           RegisterVotesParameter,
    /// The transaction hash of the ballot submission
    transaction_hash: TransactionHash,
    /// Whether the ballot proof could be verified.
    verified:         bool,
}

/// The data collected for each block.
#[derive(Debug)]
struct BlockData {
    /// The hash of the block
    block_hash: BlockHash,
    /// The height of the block
    height:     AbsoluteBlockHeight,
    /// The block time of the block
    timestamp:  DateTime<Utc>,
    /// The ballots submitted in the block
    ballots:    Vec<BallotSubmission>,
}

struct DBSettings {
    latest_height:    Option<AbsoluteBlockHeight>,
    contract_address: ContractAddress,
}

impl TryFrom<tokio_postgres::Row> for DBSettings {
    type Error = tokio_postgres::Error;

    fn try_from(value: tokio_postgres::Row) -> Result<Self, Self::Error> {
        let raw_latest_height: Option<i64> = value.try_get(0)?;
        let raw_contract_index: i64 = value.try_get(1)?;
        let raw_contract_subindex: i64 = value.try_get(2)?;
        let contract_address =
            ContractAddress::new(raw_contract_index as u64, raw_contract_subindex as u64);
        let settings = Self {
            latest_height: raw_latest_height.map(|v| (v as u64).into()),
            contract_address,
        };
        Ok(settings)
    }
}

/// The set of queries used to communicate with the postgres DB.
struct PreparedStatements {
    /// Insert block into DB
    insert_ballot:     tokio_postgres::Statement,
    /// Init the settings table
    init_settings:     tokio_postgres::Statement,
    /// Get the settings stored in the settings table of the DB
    get_settings:      tokio_postgres::Statement,
    /// Get the latest recorded block height from the DB
    set_latest_height: tokio_postgres::Statement,
}

impl PreparedStatements {
    /// Construct `PreparedStatements` using the supplied
    /// `tokio_postgres::Client`
    async fn new(client: &tokio_postgres::Client) -> Result<Self, tokio_postgres::Error> {
        let insert_ballot = client
            .prepare(
                "INSERT INTO ballots (transaction_hash, timestamp, ballot, account, verified) \
                 VALUES ($1, $2, $3, $4, $5)",
            )
            .await?;
        let init_settings = client
            .prepare(
                "INSERT INTO settings (contract_index, contract_subindex) VALUES ($1, $2) ON \
                 CONFLICT DO NOTHING",
            )
            .await?;
        let get_settings = client
            .prepare("SELECT latest_height, contract_index, contract_subindex FROM settings")
            .await?;
        let set_latest_height = client
            .prepare("UPDATE settings SET latest_height = $1 WHERE id = true")
            .await?;
        Ok(Self {
            insert_ballot,
            init_settings,
            get_settings,
            set_latest_height,
        })
    }

    /// Inserts a row in the settings table holding the application
    /// configuration. The table is constrained to only hold a single row.
    async fn init_settings(
        &self,
        db: &tokio_postgres::Client,
        contract_address: &ContractAddress,
    ) -> Result<(), tokio_postgres::Error> {
        let params: [&(dyn ToSql + Sync); 2] = [
            &(contract_address.index as i64),
            &(contract_address.subindex as i64),
        ];
        db.execute(&self.init_settings, &params).await?;
        Ok(())
    }

    /// Get the latest block height recorded in the DB.
    async fn get_settings(
        &self,
        db: &tokio_postgres::Client,
    ) -> Result<DBSettings, tokio_postgres::Error> {
        db.query_one(&self.get_settings, &[]).await?.try_into()
    }

    /// Set the latest height in the DB.
    async fn set_latest_height<'a, 'b>(
        &'a self,
        db_tx: &tokio_postgres::Transaction<'b>,
        height: AbsoluteBlockHeight,
    ) -> Result<(), tokio_postgres::Error> {
        let params: [&(dyn ToSql + Sync); 1] = [&(height.height as i64)];
        db_tx.execute(&self.set_latest_height, &params).await?;
        Ok(())
    }

    /// Insert a ballot submission into the DB.
    async fn insert_ballot<'a, 'b>(
        &'a self,
        db_tx: &tokio_postgres::Transaction<'b>,
        timestamp: DateTime<Utc>,
        ballot: &BallotSubmission,
    ) -> anyhow::Result<()> {
        let timestamp = chrono::NaiveDateTime::from_timestamp_millis(timestamp.timestamp_millis())
            .context("Expect timestamp to be in range of u64")?;
        let params: [&(dyn ToSql + Sync); 5] = [
            &ballot.transaction_hash.as_ref(),
            &timestamp,
            &Json(&ballot.ballot),
            &ballot.account.0.as_ref(),
            &false,
        ];
        db_tx.execute(&self.insert_ballot, &params).await?;
        Ok(())
    }
}

/// Holds [`tokio_postgres::Client`] to query the database and
/// [`PreparedStatements`] which can be executed with the client.
struct DBConn {
    client:            tokio_postgres::Client,
    prepared:          PreparedStatements,
    connection_handle: JoinHandle<()>,
}

impl DBConn {
    /// Create new `DBConn` from `tokio_postgres::config::Config`. If
    /// `try_create_tables` is true, database tables are created using
    /// `/resources/schema.sql`.
    async fn create(
        conn_string: tokio_postgres::config::Config,
        try_create_tables: bool,
    ) -> anyhow::Result<Self> {
        let (client, connection) = conn_string
            .connect(tokio_postgres::NoTls)
            .await
            .context("Could not create database connection")?;

        let connection_handle = tokio::spawn(async move {
            if let Err(e) = connection.await {
                println!("Connection error: {}", e);
            }
        });

        if try_create_tables {
            let create_statements = include_str!("../resources/schema.sql");
            client
                .batch_execute(create_statements)
                .await
                .context("Failed to execute create statements")?;
        }

        let prepared = PreparedStatements::new(&client).await?;
        let db_conn = DBConn {
            client,
            prepared,
            connection_handle,
        };

        Ok(db_conn)
    }
}

/// Runs a process of inserting data coming in on `block_receiver` in a database
/// defined in `db_connection`
async fn run_db_process(
    db_connection: tokio_postgres::config::Config,
    contract_address: &ContractAddress,
    mut block_receiver: tokio::sync::mpsc::Receiver<BlockData>,
    height_sender: tokio::sync::oneshot::Sender<Option<AbsoluteBlockHeight>>,
    stop_flag: Arc<AtomicBool>,
) -> anyhow::Result<()> {
    let mut db = DBConn::create(db_connection.clone(), true)
        .await
        .context("Could not create database connection")?;
    db.prepared
        .init_settings(&db.client, contract_address)
        .await
        .context("Could not init settings in DB")?;
    let settings = db
        .prepared
        .get_settings(&db.client)
        .await
        .context("Could not get best height from database")?;

    anyhow::ensure!(
        settings.contract_address == *contract_address,
        "Contract address does not match the contract address found in the database"
    );

    height_sender
        .send(settings.latest_height)
        .map_err(|_| anyhow!("Best block height could not be sent to node process"))?;

    // In case of DB errors, this is used to store the value to retry insertion for
    let mut retry_block_data = None;
    // How many successive insertion errors were encountered.
    // This is used to slow down attempts to not spam the database
    let mut successive_db_errors = 0;

    while !stop_flag.load(Ordering::Acquire) {
        let next_block_data = if retry_block_data.is_some() {
            retry_block_data
        } else {
            block_receiver.recv().await
        };

        if let Some(block_data) = next_block_data {
            match db_insert_block(&mut db, &block_data).await {
                Ok(time) => {
                    successive_db_errors = 0;
                    println!(
                        "Processed block {} at height {} transactions in {}ms",
                        block_data.block_hash,
                        block_data.height.height,
                        time.num_milliseconds()
                    );
                    retry_block_data = None;
                }
                Err(e) => {
                    successive_db_errors += 1;
                    // wait for 2^(min(successive_errors - 1, 7)) seconds before attempting.
                    // The reason for the min is that we bound the time between reconnects.
                    let delay = std::time::Duration::from_millis(
                        500 * (1 << std::cmp::min(successive_db_errors, 8)),
                    );
                    println!(
                        "Database connection lost due to {:#}. Will attempt to reconnect in {}ms.",
                        e,
                        delay.as_millis()
                    );
                    tokio::time::sleep(delay).await;

                    let new_db = match DBConn::create(db_connection.clone(), false).await {
                        Ok(db) => db,
                        Err(e) => {
                            block_receiver.close();
                            return Err(e);
                        }
                    };

                    // and drop the old database connection.
                    let old_db = std::mem::replace(&mut db, new_db);
                    old_db.connection_handle.abort();

                    retry_block_data = Some(block_data);
                }
            }
        } else {
            break;
        }
    }

    block_receiver.close();
    db.connection_handle.abort();

    Ok(())
}

/// Inserts the `block_data` collected for a single block into the database
/// defined by `db`. Everything is commited as a single transactions allowing
/// for easy restoration from the last recorded block (by height) inserted into
/// the database. Returns the duration it took to process the block.
async fn db_insert_block<'a>(
    db: &mut DBConn,
    block_data: &'a BlockData,
) -> anyhow::Result<chrono::Duration> {
    let start = chrono::Utc::now();
    let db_tx = db
        .client
        .transaction()
        .await
        .context("Failed to build DB transaction")?;

    let tx_ref = &db_tx;
    let prepared_ref = &db.prepared;

    println!("Received block data: {:?}", block_data);

    prepared_ref
        .set_latest_height(tx_ref, block_data.height)
        .await?;

    for ballot in block_data.ballots.iter() {
        prepared_ref
            .insert_ballot(tx_ref, block_data.timestamp, ballot)
            .await?;
    }

    let now = tokio::time::Instant::now();
    db_tx
        .commit()
        .await
        .context("Failed to commit DB transaction.")?;
    println!("Commit completed in {}ms.", now.elapsed().as_millis());

    let end = chrono::Utc::now().signed_duration_since(start);
    Ok(end)
}

/// Construct a future for shutdown signals (for unix: SIGINT and SIGTERM) (for
/// windows: ctrl c and ctrl break). The signal handler is set when the future
/// is polled and until then the default signal handler.
async fn set_shutdown(flag: Arc<AtomicBool>) -> anyhow::Result<()> {
    #[cfg(unix)]
    {
        use tokio::signal::unix as unix_signal;
        let mut terminate_stream = unix_signal::signal(unix_signal::SignalKind::terminate())?;
        let mut interrupt_stream = unix_signal::signal(unix_signal::SignalKind::interrupt())?;
        let terminate = Box::pin(terminate_stream.recv());
        let interrupt = Box::pin(interrupt_stream.recv());
        futures::future::select(terminate, interrupt).await;
        flag.store(true, Ordering::Release);
    }
    #[cfg(windows)]
    {
        use tokio::signal::windows as windows_signal;
        let mut ctrl_break_stream = windows_signal::ctrl_break()?;
        let mut ctrl_c_stream = windows_signal::ctrl_c()?;
        let ctrl_break = Box::pin(ctrl_break_stream.recv());
        let ctrl_c = Box::pin(ctrl_c_stream.recv());
        futures::future::select(ctrl_break, ctrl_c).await;
        flag.store(true, Ordering::Release);
    }
    Ok(())
}

/// Extracts the ballot submission (if any) from `transaction`.
fn get_ballot_submission(
    transaction: BlockItemSummary,
    contract_address: &ContractAddress,
) -> Option<BallotSubmission> {
    let account = transaction.sender_account()?;
    let transaction_hash = transaction.hash;
    let ExecutionTree::V1(ExecutionTreeV1 {
        address,
        receive_name,
        message,
        ..
    }) = transaction.contract_update()?
    else {
        return None;
    };

    if address != *contract_address || receive_name != REGISTER_VOTES_RECEIVE {
        return None;
    };

    let ballot = contracts_common::from_bytes::<RegisterVotesParameter>(message.as_ref()).ok()?;
    let ballot_submission = BallotSubmission {
        ballot,
        verified: false, // TODO: verify with election guard
        account,
        transaction_hash,
    };
    Some(ballot_submission)
}

/// Process a block, represented by `block_hash`, checking it for election
/// ballot submissions to `contract_address` and returning [`BlockSubmissions`]
/// if any were found.
///
/// Returns error if any occur while querying the node
async fn process_block(
    node: &mut Client,
    block_hash: BlockHash,
    contract_address: &ContractAddress,
) -> anyhow::Result<BlockData> {
    let block_info = node
        .get_block_info(block_hash)
        .await
        .with_context(|| format!("Could not get block info for block: {}", block_hash))?
        .response;

    let ballots: Vec<_> = node
        .get_block_transaction_events(block_info.block_hash)
        .await
        .with_context(|| format!("Could not get transactions for block: {}", block_hash))?
        .response
        .try_filter_map(|transaction| {
            future::ok(get_ballot_submission(transaction, contract_address))
        })
        .try_collect()
        .await
        .with_context(|| {
            format!(
                "Error while streaming transactions for block: {}",
                block_hash
            )
        })?;

    let block_data = BlockData {
        block_hash,
        height: block_info.block_height,
        timestamp: block_info.block_slot_time,
        ballots,
    };

    Ok(block_data)
}

/// Verify that the contract instance represented by `contract_address` is an
/// election contract. We check this to avoid failing silently from not indexing
/// any transactions made to the contract due to either listening to
/// transactions made to the wrong contract of a wrong contract entrypoint.
async fn verify_contract(
    node: &mut Client,
    contract_address: &ContractAddress,
) -> anyhow::Result<()> {
    let instance_info = node
        .get_instance_info(*contract_address, BlockIdentifier::LastFinal)
        .await
        .context("Could not get instance info for election contract")?
        .response;
    let methods = match instance_info {
        InstanceInfo::V0 { methods, .. } => methods,
        InstanceInfo::V1 { methods, .. } => methods,
    };

    anyhow::ensure!(
        methods.iter().any(|m| m == REGISTER_VOTES_RECEIVE),
        format!(
            "Expected method with receive name \"{}\" to be available on contract",
            REGISTER_VOTES_RECEIVE
        )
    );

    Ok(())
}

/// Config spanning accross all `node_pcocess invocatoins.`
struct NodeProcessConfig {
    /// Whether the contract has been verified to be an election contract.
    contract_verified: bool,
    /// The latest processed height.
    processed_height:  Option<AbsoluteBlockHeight>,
}

impl From<Option<AbsoluteBlockHeight>> for NodeProcessConfig {
    fn from(value: Option<AbsoluteBlockHeight>) -> Self {
        Self {
            contract_verified: Default::default(),
            processed_height:  value,
        }
    }
}

/// Queries the node available at `node_endpoint` from `latest_height` until
/// stopped. Sends the data structured by block to DB process through
/// `block_sender`. Process runs until stopped or an error happens internally.
async fn node_process(
    node_endpoint: Endpoint,
    contract_address: &ContractAddress,
    config: &mut NodeProcessConfig,
    block_sender: &tokio::sync::mpsc::Sender<BlockData>,
    max_behind_s: u32,
    stop_flag: &AtomicBool,
) -> anyhow::Result<()> {
    let mut node = Client::new(node_endpoint.clone())
        .await
        .context("Could not connect to node.")?;

    if !config.contract_verified {
        verify_contract(&mut node, contract_address).await?;
        config.contract_verified = true;
    }

    let from_height = if let Some(height) = config.processed_height {
        height.next()
    } else {
        let (height, ..) = node
            .find_instance_creation(.., *contract_address)
            .await
            .context("Could not find contract instance creation block")?;
        height
    };

    println!(
        "Processing blocks from height {} using node {}",
        from_height,
        node_endpoint.uri()
    );

    let mut blocks_stream = node
        .get_finalized_blocks_from(from_height)
        .await
        .context("Error querying blocks")?;
    let timeout = std::time::Duration::from_secs(max_behind_s.into());
    while !stop_flag.load(Ordering::Acquire) {
        let block = blocks_stream
            .next_timeout(timeout)
            .await
            .with_context(|| format!("Timeout reached for node: {}", node_endpoint.uri()))?;
        let Some(block) = block else {
            return Err(anyhow!("Finalized block stream dropped"));
        };
        let block_data = process_block(&mut node, block.block_hash, contract_address).await?;
        if block_sender.send(block_data).await.is_err() {
            println!("The database connection has been closed. Terminating node queries.");
            return Ok(());
        }

        config.processed_height = Some(block.height);
    }

    println!("Service stopped gracefully from exit signal.");
    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

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

    // Since the database connection is managed by the background task we use a
    // oneshot channel to get the height we should start querying at. First the
    // background database task is started which then sends the height over this
    // channel.
    let (height_sender, height_receiver) = tokio::sync::oneshot::channel();
    // Create a channel between the task querying the node and the task logging
    // transactions.
    let (block_sender, block_receiver) = tokio::sync::mpsc::channel(100);
    // node/db processes run until the stop flag is triggered.
    let stop_flag = Arc::new(AtomicBool::new(false));
    let shutdown_handle = tokio::spawn(set_shutdown(stop_flag.clone()));

    let db_stop = stop_flag.clone();
    let db_handle = tokio::spawn(async move {
        let result = run_db_process(
            args.db_connection,
            &args.contract_address,
            block_receiver,
            height_sender,
            db_stop,
        )
        .await;
        if let Err(error) = result {
            println!("Error happened while running DB process: {:?}", error);
        }
    });

    let latest_height = height_receiver
        .await
        .context("Did not receive height of most recent block recorded in database")?;
    let latest_height = latest_height.or(args
        .from_height
        .map(|v| (v.height.saturating_sub(1)).into()));

    let mut latest_successful_node: u64 = 0;
    let mut node_process_config: NodeProcessConfig = latest_height.into();
    let num_nodes = args.node_endpoints.len() as u64;
    for (node, i) in args.node_endpoints.into_iter().cycle().zip(0u64..) {
        let start_height = latest_height;

        if stop_flag.load(Ordering::Acquire) {
            break;
        }

        if i.saturating_sub(latest_successful_node) >= num_nodes {
            // we skipped all the nodes without success.
            let delay = std::time::Duration::from_secs(5);
            println!(
                "Connections to all nodes have failed. Pausing for {}s before trying node {} \
                 again.",
                delay.as_secs(),
                node.uri()
            );
            tokio::time::sleep(delay).await;
        }

        // The process keeps running until stopped manually, or an error happens.
        let node_result = node_process(
            node.clone(),
            &args.contract_address,
            &mut node_process_config,
            &block_sender,
            args.max_behind_s,
            stop_flag.as_ref(),
        )
        .await;

        if let Err(e) = node_result {
            println!(
                "Endpoint {} failed with error {}. Trying next.",
                node.uri(),
                e
            );
        } else {
            // `node_process` terminated with `Ok`, meaning we should stop the service
            // entirely.
            break;
        }

        if latest_height > start_height {
            latest_successful_node = i;
        }
    }

    db_handle.abort();
    shutdown_handle.abort();
    Ok(())
}
