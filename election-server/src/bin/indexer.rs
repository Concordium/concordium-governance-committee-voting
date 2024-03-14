use anyhow::{anyhow, Context};
use chrono::{DateTime, Utc};
use clap::Parser;
use concordium_governance_committee_election::{ElectionConfig, RegisterVotesParameter};
use concordium_rust_sdk::{
    smart_contracts::common as contracts_common,
    types::{
        execution_tree, hashes::BlockHash, queries::BlockInfo, AbsoluteBlockHeight,
        AccountTransactionEffects, BlockItemSummary, BlockItemSummaryDetails, ContractAddress,
        ExecutionTree, ExecutionTreeV1,
    },
    v2::{self, Client},
};
use eg::{
    ballot::BallotEncrypted, election_manifest::ElectionManifest,
    election_parameters::ElectionParameters, election_record::PreVotingData,
    guardian_public_key::GuardianPublicKey, hashes::Hashes, hashes_ext::HashesExt,
    joint_election_public_key::JointElectionPublicKey,
};
use election_common::decode;
use election_server::{
    db::{Database, DatabasePool, Transaction},
    util::{
        create_client, get_election_config, verify_checksum, verify_contract, BallotSubmission,
        ElectionContract, VotingPowerDelegation, REGISTER_VOTES_RECEIVE,
    },
};
use futures::{future, TryStreamExt};
use std::{
    fs,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};

/// Command line configuration of the application.
#[derive(Debug, Parser, Clone)]
#[clap(version, author)]
struct AppConfig {
    /// The node(s) used for querying
    #[arg(
        long = "node",
        help = "The endpoints are expected to point to concordium node grpc v2 API's.",
        default_value = "http://localhost:20001",
        env = "CCD_ELECTION_NODES",
        value_delimiter = ','
    )]
    node_endpoints:     Vec<v2::Endpoint>,
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
    /// The contract address used to filter contract updates
    #[arg(long = "contract-address", env = "CCD_ELECTION_CONTRACT_ADDRESS")]
    contract_address:   ContractAddress,
    /// Maximum log level
    #[clap(
        long = "log-level",
        default_value = "info",
        env = "CCD_ELECTION_LOG_LEVEL"
    )]
    log_level:          tracing_subscriber::filter::LevelFilter,
    /// Max amount of seconds a response from a node can fall behind before
    /// trying another.
    #[arg(
        long = "max-behind-seconds",
        default_value_t = 240,
        env = "CCD_ELECTION_MAX_BEHIND_SECONDS"
    )]
    max_behind_s:       u32,
    #[clap(
        long = "election-manifest-file",
        default_value = "../resources/config-example/election-manifest.json",
        env = "CCD_ELECTION_ELECTION_MANIFEST_FILE"
    )]
    eg_manifest_file:   std::path::PathBuf,
    /// A json file consisting of the election parameters used by election guard
    #[clap(
        long = "election-parameters-file",
        default_value = "../resources/config-example/election-parameters.json",
        env = "CCD_ELECTION_ELECTION_PARAMETERS_FILE"
    )]
    eg_parameters_file: std::path::PathBuf,
    /// The request timeout of the http server (in milliseconds)
    #[clap(
        long = "request-timeout-ms",
        default_value_t = 5000,
        env = "CCD_ELECTION_REQUEST_TIMEOUT_MS"
    )]
    request_timeout_ms: u64,
}

impl AppConfig {
    /// Deserializes the election guard config files. The supplied [`Client`] is
    /// used to verify the files match the checksum registered in the
    /// election contract.
    fn read_and_verify_config_files(
        &self,
        contract_config: &ElectionConfig,
    ) -> Result<(ElectionManifest, ElectionParameters), anyhow::Error> {
        verify_checksum(
            &self.eg_manifest_file,
            contract_config.election_manifest.hash.0,
        )
        .context("Manifest file hash not as recorded in the contract.")?;
        let election_manifest: ElectionManifest = serde_json::from_reader(
            fs::File::open(&self.eg_manifest_file).context("Could not read election manifest")?,
        )?;

        verify_checksum(
            &self.eg_parameters_file,
            contract_config.election_parameters.hash.0,
        )
        .context("Election parameters file hash not as recorded in the contract.")?;
        let election_parameters: ElectionParameters = serde_json::from_reader(
            fs::File::open(&self.eg_parameters_file)
                .context("Could not read election parameters")?,
        )?;
        Ok((election_manifest, election_parameters))
    }
}

/// The transactions indexed
#[derive(Debug)]
enum TransactionData {
    /// Represents a ballot submission
    BallotSubmission(BallotSubmission),
    /// Represents a voting power delegation
    Delegation(VotingPowerDelegation),
}

impl From<BallotSubmission> for TransactionData {
    fn from(value: BallotSubmission) -> Self { Self::BallotSubmission(value) }
}

impl From<VotingPowerDelegation> for TransactionData {
    fn from(value: VotingPowerDelegation) -> Self { Self::Delegation(value) }
}

/// The data collected for each block.
#[derive(Debug)]
struct BlockData {
    /// The hash of the block
    block_hash:   BlockHash,
    /// The height of the block
    height:       AbsoluteBlockHeight,
    /// The block time of the block
    block_time:   DateTime<Utc>,
    /// The transactions to index
    transactions: Vec<TransactionData>,
}

/// Runs a process of inserting data coming in on `block_receiver` in a database
/// defined in `db_connection`
async fn run_db_process(
    db_connection: tokio_postgres::config::Config,
    contract_address: ContractAddress,
    mut block_receiver: tokio::sync::mpsc::Receiver<BlockData>,
    height_sender: tokio::sync::oneshot::Sender<Option<AbsoluteBlockHeight>>,
    stop_flag: Arc<AtomicBool>,
) -> anyhow::Result<()> {
    let db_pool = DatabasePool::create(db_connection.clone(), 2, true)
        .await
        .context("Could not create database pool")?;
    let mut db = db_pool
        .get()
        .await
        .context("Could not get database connection from pool")?;
    db.init_settings(&contract_address)
        .await
        .context("Could not init settings for database")?;
    let settings = db
        .get_settings()
        .await
        .context("Could not get settings from database")?;

    anyhow::ensure!(
        settings.contract_address == contract_address,
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
                    tracing::info!(
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
                    tracing::warn!(
                        "Database connection lost due to {:#}. Will attempt to reconnect in {}ms.",
                        e,
                        delay.as_millis()
                    );
                    tokio::time::sleep(delay).await;

                    // Get new db connection from the pool
                    db = match db_pool
                        .get()
                        .await
                        .context("Failed to get new database connection from pool")
                    {
                        Ok(db) => db,
                        Err(e) => {
                            block_receiver.close();
                            return Err(e);
                        }
                    };
                    retry_block_data = Some(block_data);
                }
            }
        } else {
            break;
        }
    }

    block_receiver.close();
    Ok(())
}

/// Inserts the `block_data` collected for a single block into the database
/// defined by `db`. Everything is commited as a single transactions allowing
/// for easy restoration from the last recorded block (by height) inserted into
/// the database. Returns the duration it took to process the block.
#[tracing::instrument(skip_all, fields(block_hash = %block_data.block_hash, block_time = %block_data.block_time))]
async fn db_insert_block<'a>(
    db: &mut Database,
    block_data: &'a BlockData,
) -> anyhow::Result<chrono::Duration> {
    let start = chrono::Utc::now();
    let transaction = db
        .client
        .transaction()
        .await
        .context("Failed to build DB transaction")?;

    let transaction = Transaction::from(transaction);
    transaction.set_latest_height(block_data.height).await?;

    for transaction_data in block_data.transactions.iter() {
        match transaction_data {
            TransactionData::BallotSubmission(ballot) => {
                transaction
                    .insert_ballot(ballot, block_data.block_time)
                    .await?;
            }
            TransactionData::Delegation(delegation) => {
                transaction
                    .insert_delegation(delegation, block_data.block_time)
                    .await?;
            }
        }
    }

    let now = tokio::time::Instant::now();
    transaction
        .inner
        .commit()
        .await
        .context("Failed to commit DB transaction.")?;
    tracing::debug!("Commit completed in {}ms.", now.elapsed().as_millis());

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

/// Extracts the relevant [`TransactionData`] (if any) from `transaction`.
#[tracing::instrument(skip(transaction), fields(tx_hash = %transaction.hash))]
fn get_transaction_data(
    transaction: BlockItemSummary,
    contract_address: &ContractAddress,
    verification_context: &PreVotingData,
    delegation_string: &str,
) -> Option<TransactionData> {
    let from_account = transaction.sender_account()?;
    let transaction_hash = transaction.hash;
    let BlockItemSummaryDetails::AccountTransaction(transaction) = transaction.details else {
        return None;
    };
    let transaction_data = match transaction.effects {
        AccountTransactionEffects::AccountTransferWithMemo { to, memo, .. } => {
            let Ok(memo) = serde_cbor::from_slice::<String>(memo.as_ref()) else {
                return None;
            };
            if memo != delegation_string {
                return None;
            };
            TransactionData::Delegation(VotingPowerDelegation {
                from_account,
                to_account: to,
                transaction_hash,
            })
        }
        AccountTransactionEffects::ContractUpdateIssued { effects } => {
            let ExecutionTree::V1(ExecutionTreeV1 {
                address,
                receive_name,
                message,
                ..
            }) = execution_tree(effects)?
            else {
                return None;
            };
            if address != *contract_address || receive_name != REGISTER_VOTES_RECEIVE {
                return None;
            };
            let ballot =
                match contracts_common::from_bytes::<RegisterVotesParameter>(message.as_ref())
                    .context("Failed to parse ballot from transaction message")
                    .and_then(|bytes| {
                        decode::<BallotEncrypted>(&bytes.inner)
                            .context("Failed parse encrypted ballot")
                    }) {
                    Ok(ballot) => ballot,
                    Err(err) => {
                        tracing::warn!("Could not parse ballot: {}", err);
                        return None;
                    }
                };
            let verified = ballot.verify(
                verification_context,
                eg::index::Index::from_one_based_index(1).unwrap(),
            );
            TransactionData::BallotSubmission(BallotSubmission {
                ballot,
                verified,
                account: from_account,
                transaction_hash,
            })
        }
        _ => return None,
    };
    Some(transaction_data)
}

/// Process a block, represented by `block_hash`, checking it for election
/// ballot submissions to `contract_address` and returning [`BlockSubmissions`]
/// if any were found.
///
/// Returns error if any occur while querying the node
async fn process_block(
    node: &mut Client,
    block_info: BlockInfo,
    contract_address: &ContractAddress,
    verification_context: &PreVotingData,
    delegation_string: &str,
) -> anyhow::Result<BlockData> {
    let block_hash = block_info.block_hash;
    let transactions: Vec<_> = node
        .get_block_transaction_events(block_info.block_hash)
        .await
        .with_context(|| format!("Could not get transactions for block: {}", block_hash))?
        .response
        .try_filter_map(|transaction| {
            future::ok(get_transaction_data(
                transaction,
                contract_address,
                verification_context,
                delegation_string,
            ))
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
        block_time: block_info.block_slot_time,
        transactions,
    };

    Ok(block_data)
}

/// Find the block height corresponding to the start time of the election. If
/// the election start time is in the future, this function will pause the
/// thread until the election has started, after which it will return the block
/// height corresponding to the latest finalized block.
async fn find_election_start_height(
    client: &mut ElectionContract,
) -> anyhow::Result<AbsoluteBlockHeight> {
    let contract_config = get_election_config(client).await?;
    let election_start: DateTime<Utc> = contract_config.election_start.try_into()?;

    let now = Utc::now();
    if election_start > now {
        tracing::info!(
            "Election has not started yet. Resuming execution at {}",
            election_start
        );

        // As there is nothing to do until the election starts, wait until then.
        tokio::time::sleep(election_start.signed_duration_since(now).to_std()?).await;
    }

    let (creation_height, ..) = client
        .client
        .find_instance_creation(.., client.address)
        .await
        .context("Could not find contract instance creation block")?;

    let query_range = creation_height..;
    let mut result = client
        .client
        .find_first_finalized_block_no_earlier_than(query_range.clone(), election_start)
        .await;

    // If the result is an error, it means that the block we're waiting for has not
    // yet been finalized. As such, we wait until we find the block by querying
    // periodically.
    while result.is_err() {
        tokio::time::sleep(Duration::from_secs(2)).await;
        result = client
            .client
            .find_first_finalized_block_no_earlier_than(query_range.clone(), election_start)
            .await;
    }

    let block_info = result.unwrap(); // We already checked for errors in the loop above.
    Ok(block_info.block_height)
}

/// Queries the node available at `node_endpoint` from `latest_height` until
/// stopped. Sends the data structured by block to DB process through
/// `block_sender`. Process runs until stopped or an error happens internally.
#[allow(clippy::too_many_arguments)]
#[tracing::instrument(skip_all, fields(node_endpoint = %node_endpoint.uri(), from_height = ?from_height))]
async fn node_process(
    node_endpoint: v2::Endpoint,
    request_timeout: std::time::Duration,
    contract_address: &ContractAddress,
    verification_context: &PreVotingData,
    delegation_string: &str,
    from_height: &mut AbsoluteBlockHeight,
    block_sender: &tokio::sync::mpsc::Sender<BlockData>,
    max_behind_s: u32,
    stop_flag: &AtomicBool,
    run_until: DateTime<Utc>,
) -> anyhow::Result<()> {
    let node_uri = node_endpoint.uri().clone();
    let mut node = create_client(node_endpoint, request_timeout).await?;

    tracing::info!("Processing blocks using node {}", &node_uri);

    let mut blocks_stream = node
        .get_finalized_blocks_from(*from_height)
        .await
        .context("Error querying blocks")?;
    let timeout = std::time::Duration::from_secs(max_behind_s.into());
    while !stop_flag.load(Ordering::Acquire) {
        let block = blocks_stream
            .next_timeout(timeout)
            .await
            .with_context(|| format!("Timeout reached for node: {}", node_uri))?;
        let Some(block) = block else {
            return Err(anyhow!("Finalized block stream dropped"));
        };
        let block_info = node
            .get_block_info(block.block_hash)
            .await
            .with_context(|| format!("Could not get block info for block: {}", block.block_hash))?
            .response;

        if block_info.block_slot_time > run_until {
            tracing::info!("Election window has closed; stopping service.");
            return Ok(());
        };

        let block_data = process_block(
            &mut node,
            block_info,
            contract_address,
            verification_context,
            delegation_string,
        )
        .await?;
        if block_sender.send(block_data).await.is_err() {
            tracing::error!("The database connection has been closed. Terminating node queries.");
            return Ok(());
        }

        *from_height = block.height;
    }

    tracing::info!("Service stopped gracefully from exit signal.");
    Ok(())
}

/// Constructs the [`PreVotingData`] necessary for ballot verification with
/// election guard.
fn get_verification_context(
    election_parameters: ElectionParameters,
    election_manifest: ElectionManifest,
    guardian_public_keys: Vec<GuardianPublicKey>,
) -> anyhow::Result<PreVotingData> {
    let joint_election_public_key =
        JointElectionPublicKey::compute(&election_parameters, &guardian_public_keys)
            .context("Could not compute joint election public key")?;

    let hashes = Hashes::compute(&election_parameters, &election_manifest)
        .context("Could not compute hashes from election context")?;

    let hashes_ext = HashesExt::compute(
        &election_parameters,
        &hashes,
        &joint_election_public_key,
        guardian_public_keys.as_slice(),
    );

    let pre_voting_data = PreVotingData {
        manifest: election_manifest,
        parameters: election_parameters,
        hashes,
        hashes_ext,
        public_key: joint_election_public_key,
    };

    Ok(pre_voting_data)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = AppConfig::parse();

    {
        use tracing_subscriber::prelude::*;
        let log_filter = tracing_subscriber::filter::Targets::new()
            .with_target(module_path!(), config.log_level)
            .with_target("election_server", config.log_level);

        tracing_subscriber::registry()
            .with(tracing_subscriber::fmt::layer())
            .with(log_filter)
            .init();
    }

    tracing::info!("Starting indexer version {}", env!("CARGO_PKG_VERSION"));

    let request_timeout = std::time::Duration::from_millis(config.request_timeout_ms);

    let ep = config
        .node_endpoints
        .first()
        .context("Expected endpoint to be defined")?
        .clone();
    let client = create_client(ep, request_timeout).await?;

    let mut contract_client = verify_contract(client, config.contract_address).await?;
    let contract_config = get_election_config(&mut contract_client).await?;
    let (election_manifest, election_parameters) =
        config.read_and_verify_config_files(&contract_config)?;

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
            config.db_connection,
            config.contract_address,
            block_receiver,
            height_sender,
            db_stop,
        )
        .await;

        if let Err(err) = result {
            tracing::error!("Error happened while running the DB process: {:?}", err);
        }
    });

    let latest_height = height_receiver
        .await
        .context("Did not receive height of most recent block recorded in database")?;

    let mut from_height = if let Some(height) = latest_height {
        height.next()
    } else {
        // after this point, we're sure the election is in the "voting" phase.
        find_election_start_height(&mut contract_client).await?
    };

    // The election has moved from the "setup" phase to the "voting" phase, i.e. all
    // election guardians should have registered their keys needed for ballot
    // verification at this point.
    let contract_config = get_election_config(&mut contract_client).await?;
    let guardian_public_keys = contract_config
        .guardian_keys
        .iter()
        .map(|bytes| decode::<GuardianPublicKey>(bytes))
        .collect::<Result<Vec<GuardianPublicKey>, _>>()
        .context("Could not deserialize guardian public key")?;
    let verification_context =
        get_verification_context(election_parameters, election_manifest, guardian_public_keys)?;
    let delegation_string = contract_config.delegation_string;

    let mut latest_successful_node: u64 = 0;
    let num_nodes = config.node_endpoints.len() as u64;
    for (node, i) in config.node_endpoints.into_iter().cycle().zip(0u64..) {
        let start_height = latest_height;

        if stop_flag.load(Ordering::Acquire) {
            break;
        }

        if i.saturating_sub(latest_successful_node) >= num_nodes {
            // we skipped all the nodes without success.
            let delay = std::time::Duration::from_secs(5);
            tracing::warn!(
                "Connections to all nodes have failed. Pausing for {}s before trying node {} \
                 again.",
                delay.as_secs(),
                node.uri()
            );
            tokio::time::sleep(delay).await;
        }

        let node_uri = node.uri().clone();
        // The process keeps running until stopped manually, or an error happens.
        let node_result = node_process(
            node,
            request_timeout,
            &config.contract_address,
            &verification_context,
            &delegation_string,
            &mut from_height,
            &block_sender,
            config.max_behind_s,
            stop_flag.as_ref(),
            contract_config.election_end.try_into()?,
        )
        .await;

        if let Err(e) = node_result {
            tracing::warn!(
                "Endpoint {} failed with error {}. Trying next.",
                node_uri,
                e
            );
        } else {
            // `node_process` terminated with `Ok`, meaning we should stop the service
            // entirely.
            drop(block_sender);
            break;
        }

        if latest_height > start_height {
            latest_successful_node = i;
        }
    }

    db_handle.await?;
    shutdown_handle.abort();
    Ok(())
}
