use anyhow::{anyhow, Context};
use chrono::{DateTime, Utc};
use clap::Parser;
use concordium_governance_committee_election::{ElectionConfig, RegisterVotesParameter};
use concordium_rust_sdk::{
    smart_contracts::common::{self as contracts_common},
    types::{
        hashes::BlockHash,
        smart_contracts::{ContractContext, InstanceInfo, InvokeContractResult, OwnedReceiveName},
        AbsoluteBlockHeight, BlockItemSummary, ContractAddress, ExecutionTree, ExecutionTreeV1,
    },
    v2::{BlockIdentifier, Client, Endpoint},
};
use eg::{
    ballot::BallotEncrypted, election_manifest::ElectionManifest,
    election_parameters::ElectionParameters, election_record::PreVotingData,
    guardian_public_key::GuardianPublicKey, hashes::Hashes, hashes_ext::HashesExt,
    joint_election_public_key::JointElectionPublicKey,
};
use election_server::{
    db::{Database, DatabasePool, Transaction},
    types::BallotSubmission,
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

const REGISTER_VOTES_RECEIVE: &str = "election.registerVotes";
const CONFIG_VIEW: &str = "election.viewConfig";

/// Command line configuration of the application.
#[derive(Debug, Parser, Clone)]
struct AppConfig {
    /// The node(s) used for querying
    #[arg(
        long = "node",
        help = "The endpoints are expected to point to concordium node grpc v2 API's.",
        default_value = "http://localhost:20001",
        env = "CCD_ELECTION_NODES",
        value_delimiter = ','
    )]
    node_endpoints:        Vec<concordium_rust_sdk::v2::Endpoint>,
    /// Database connection string.
    #[arg(
        long = "db-connection",
        default_value = "host=localhost dbname=gc-election user=postgres password=password \
                         port=5432",
        help = "A connection string detailing the connection to the database used by the \
                application.",
        env = "CCD_ELECTION_DB_CONNECTION"
    )]
    db_connection:         tokio_postgres::config::Config,
    /// The contract address used to filter contract updates
    #[arg(long = "contract-address", env = "CCD_ELECTION_CONTRACT_ADDRESS")]
    contract_address:      ContractAddress,
    /// Maximum log level
    #[clap(
        long = "log-level",
        default_value = "info",
        env = "CCD_ELECTION_LOG_LEVEL"
    )]
    log_level:             tracing_subscriber::filter::LevelFilter,
    /// Max amount of seconds a response from a node can fall behind before
    /// trying another.
    #[arg(
        long = "max-behind-seconds",
        default_value_t = 240,
        env = "CCD_ELECTION_MAX_BEHIND_SECONDS"
    )]
    max_behind_s:          u32,
    #[clap(
        long = "election-manifest-file",
        default_value = "../resources/config-example/election-manifest.json",
        env = "CCD_ELECTION_ELECTION_MANIFEST_FILE"
    )]
    eg_manifest_file:      std::path::PathBuf,
    /// A json file consisting of the election parameters used by election guard
    #[clap(
        long = "election-parameters-file",
        default_value = "../resources/config-example/election-parameters.json",
        env = "CCD_ELECTION_ELECTION_PARAMETERS_FILE"
    )]
    eg_parameters_file:    std::path::PathBuf,
    /// A json file consisting of the guardian public keys of the election.
    // TODO: Temporary until guardian keys are registered in the contract.
    #[clap(
        long = "guardian-keys-file",
        default_value = "../resources/config-example/guardian-public-keys.json",
        env = "CCD_ELECTION_GUARDIAN_KEYS_FILE"
    )]
    eg_guardian_keys_file: std::path::PathBuf,
}

impl AppConfig {
    fn read_config_files(&self) -> Result<ElectionGuardConfig, anyhow::Error> {
        let election_manifest: ElectionManifest = serde_json::from_reader(
            fs::File::open(&self.eg_manifest_file).context("Could not read election manifest")?,
        )?;
        let election_parameters: ElectionParameters = serde_json::from_reader(
            fs::File::open(&self.eg_parameters_file)
                .context("Could not read election parameters")?,
        )?;
        let guardian_public_keys: Vec<GuardianPublicKey> = serde_json::from_reader(
            fs::File::open(&self.eg_guardian_keys_file)
                .context("Could not read election guardian keys")?,
        )?;

        let context = ElectionGuardConfig {
            election_manifest,
            election_parameters,
            guardian_public_keys,
        };
        Ok(context)
    }
}

/// The data collected for each block.
#[derive(Debug)]
pub struct BlockData {
    /// The hash of the block
    pub block_hash: BlockHash,
    /// The height of the block
    pub height:     AbsoluteBlockHeight,
    /// The block time of the block
    pub block_time: DateTime<Utc>,
    /// The ballots submitted in the block
    pub ballots:    Vec<BallotSubmission>,
}

/// The contextual parameters necessary to generate the encrypted ballot
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ElectionGuardConfig {
    /// The election manifest. This should be declared externally for each
    /// election.
    pub election_manifest:    ElectionManifest,
    /// The election parameters. These should be generated externally for each
    /// election.
    pub election_parameters:  ElectionParameters,
    /// The guardian public keys, which are registered in the election contract.
    pub guardian_public_keys: Vec<GuardianPublicKey>,
}

impl TryFrom<ElectionGuardConfig> for PreVotingData {
    type Error = anyhow::Error;

    fn try_from(value: ElectionGuardConfig) -> Result<Self, Self::Error> {
        let joint_election_public_key = JointElectionPublicKey::compute(
            &value.election_parameters,
            value.guardian_public_keys.as_slice(),
        )
        .context("Could not compute joint election public key")?;

        let hashes = Hashes::compute(&value.election_parameters, &value.election_manifest)
            .context("Could not compute hashes from election context")?;

        let hashes_ext = HashesExt::compute(
            &value.election_parameters,
            &hashes,
            &joint_election_public_key,
            value.guardian_public_keys.as_slice(),
        );

        let pre_voting_data = PreVotingData {
            manifest: value.election_manifest.clone(),
            parameters: value.election_parameters,
            hashes,
            hashes_ext,
            public_key: joint_election_public_key,
        };

        Ok(pre_voting_data)
    }
}

#[derive(thiserror::Error, Debug)]
#[error("Could not construct datetime from timestamp due to being out of range.")]
pub struct TimestampOutOfRangeError;

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
#[tracing::instrument(skip(db))]
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

    for ballot in block_data.ballots.iter() {
        transaction
            .insert_ballot(ballot, block_data.block_time)
            .await?;
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

/// Extracts the ballot submission (if any) from `transaction`.
#[tracing::instrument(skip(transaction), fields(tx_hash = %transaction.hash))]
fn get_ballot_submission(
    transaction: BlockItemSummary,
    contract_address: &ContractAddress,
    verification_context: &PreVotingData,
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

    let ballot = match contracts_common::from_bytes::<RegisterVotesParameter>(message.as_ref())
        .context("Failed to parse ballot from transaction message")
        .and_then(|ballot| {
            rmp_serde::from_slice::<BallotEncrypted>(&ballot)
                .context("Failed to parse ballot from transaction parameter")
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
    let ballot_submission = BallotSubmission {
        ballot,
        verified,
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
    verification_context: &PreVotingData,
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
            future::ok(get_ballot_submission(
                transaction,
                contract_address,
                verification_context,
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
        InstanceInfo::V0 { .. } => anyhow::bail!("Expected V1 contract"),
        InstanceInfo::V1 { methods, .. } => methods,
    };

    anyhow::ensure!(
        methods.iter().any(|m| m == REGISTER_VOTES_RECEIVE),
        "Expected method with receive name \"{}\" to be available on contract",
        REGISTER_VOTES_RECEIVE
    );

    Ok(())
}

/// Find the block height corresponding to the start time of the election. If
/// the election start time is in the future, this function will pause the
/// thread until the election has started, after which it will return the block
/// height corresponding to the latest finalized block.
async fn find_election_start_height(
    client: &mut Client,
    contract_address: &ContractAddress,
) -> anyhow::Result<AbsoluteBlockHeight> {
    let context = ContractContext::new(
        *contract_address,
        OwnedReceiveName::new_unchecked(CONFIG_VIEW.to_string()),
    );
    let InvokeContractResult::Success {
        return_value: Some(election_config),
        ..
    } = client
        .invoke_instance(BlockIdentifier::LastFinal, &context)
        .await?
        .response
    else {
        anyhow::bail!("Expected to be able to query election config");
    };
    let election_config: ElectionConfig =
        contracts_common::from_bytes(election_config.value.as_ref())
            .context("Failed to parse election config from contract invocation result")?;
    let election_start: DateTime<Utc> = election_config.election_start.try_into()?;

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
        .find_instance_creation(.., *contract_address)
        .await
        .context("Could not find contract instance creation block")?;

    let query_range = creation_height..;
    let mut result = client
        .find_first_finalized_block_no_later_than(query_range.clone(), election_start)
        .await;

    // If the result is an error, it means that the block we're waiting for has not
    // yet been finalized. As such, we wait until we find the block by querying
    // periodically.
    while result.is_err() {
        tokio::time::sleep(Duration::from_secs(2)).await;
        result = client
            .find_first_finalized_block_no_later_than(query_range.clone(), election_start)
            .await;
    }

    let block_info = result.unwrap(); // We already checked for errors in the loop above.
    Ok(block_info.block_height)
}

/// Queries the node available at `node_endpoint` from `latest_height` until
/// stopped. Sends the data structured by block to DB process through
/// `block_sender`. Process runs until stopped or an error happens internally.
#[tracing::instrument(skip_all, fields(node_endpoint = %node_endpoint.uri(), processed_height = ?processed_height))]
async fn node_process(
    node_endpoint: Endpoint,
    contract_address: &ContractAddress,
    verification_context: &PreVotingData,
    processed_height: &mut Option<AbsoluteBlockHeight>,
    block_sender: &tokio::sync::mpsc::Sender<BlockData>,
    max_behind_s: u32,
    stop_flag: &AtomicBool,
) -> anyhow::Result<()> {
    let mut node = Client::new(node_endpoint.clone())
        .await
        .context("Could not connect to node.")?;

    let from_height = if let Some(height) = processed_height {
        height.next()
    } else {
        find_election_start_height(&mut node, contract_address).await?
    };

    tracing::info!("Processing blocks using node {}", node_endpoint.uri());

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
        let block_data = process_block(
            &mut node,
            block.block_hash,
            contract_address,
            verification_context,
        )
        .await?;
        if block_sender.send(block_data).await.is_err() {
            tracing::error!("The database connection has been closed. Terminating node queries.");
            return Ok(());
        }

        *processed_height = Some(block.height);
    }

    tracing::info!("Service stopped gracefully from exit signal.");
    Ok(())
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

    let ep = config
        .node_endpoints
        .get(0)
        .context("Expected endpoint to be defined")?;
    let mut client = Client::new(ep.clone())
        .await
        .context("Could not create node client")?;
    verify_contract(&mut client, &config.contract_address).await?;

    let eg_config = config.read_config_files()?;
    let verification_context = PreVotingData::try_from(eg_config)?;

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

    let mut latest_height = height_receiver
        .await
        .context("Did not receive height of most recent block recorded in database")?;

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

        // The process keeps running until stopped manually, or an error happens.
        let node_result = node_process(
            node.clone(),
            &config.contract_address,
            &verification_context,
            &mut latest_height,
            &block_sender,
            config.max_behind_s,
            stop_flag.as_ref(),
        )
        .await;

        if let Err(e) = node_result {
            tracing::warn!(
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

    db_handle.await?;
    shutdown_handle.abort();
    Ok(())
}
