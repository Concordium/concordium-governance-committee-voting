//! A tool for the election coordinator to gather data from the chain, and to
//! coordinate finalization of the election.

use anyhow::{ensure, Context};
use clap::Parser;
use concordium_governance_committee_election as contract;
use concordium_rust_sdk::{
    base::transactions,
    common::types::{Timestamp, TransactionTime},
    contract_client::{self, ViewError},
    indexer,
    smart_contracts::common::{
        self as concordium_std, AccountAddress, Amount, OwnedEntrypointName,
    },
    types::{
        hashes::TransactionHash,
        queries::BlockInfo,
        smart_contracts::{OwnedContractName, WasmModule},
        AbsoluteBlockHeight, AccountAddressEq, AccountIndex, AccountTransactionEffects,
        BlockItemSummaryDetails, ContractAddress, Epoch, SpecialTransactionOutcome, WalletAccount,
    },
    v2::{self as sdk, BlockIdentifier, SpecifiedEpoch},
};
use concordium_std::schema::SchemaType;
use eg::{
    ballot::BallotEncrypted,
    election_manifest::{ContestIndex, ElectionManifest},
    election_parameters::ElectionParameters,
    election_record::PreVotingData,
    guardian::GuardianIndex,
    guardian_public_key::GuardianPublicKey,
    verifiable_decryption::VerifiableDecryption,
};
use election_common::{
    decode, encode, get_scaling_factor, EncryptedTally, GuardianDecryption,
    GuardianDecryptionProof, HttpClient, WeightRow,
};
use futures::{future::join_all, TryStreamExt};
use indicatif::{ProgressBar, ProgressStyle};
use rayon::iter::{IntoParallelIterator, ParallelIterator as _};
use sha2::Digest as _;
use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    ffi::OsStr,
    fmt::Debug,
    io::Write,
    str::FromStr,
};

/// Command line configuration of the application.
#[derive(Debug, clap::Parser)]
#[command(author, version, about)]
struct Args {
    /// The node used for querying
    #[arg(
        long = "node",
        help = "The node endpoint.",
        default_value = "http://localhost:20001",
        global = true
    )]
    node_endpoint: concordium_rust_sdk::v2::Endpoint,
    #[command(subcommand)]
    command:       Command,
}

/// Describes the possible locations of a candidate metadata file
#[derive(Clone, Debug)]
enum CandidateLocation {
    /// The file is located remotely, denoted by the inner [`url::Url`]
    Remote(url::Url),
    /// The file is located locally, denoted by the inner [`std::path::PathBuf`]
    Disk(std::path::PathBuf),
}

impl FromStr for CandidateLocation {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if let Ok(url) = url::Url::from_str(s) {
            return Ok(Self::Remote(url));
        }
        let path =
            std::path::PathBuf::from_str(s).context("Failed to parse {s} as either url or path")?;
        Ok(Self::Disk(path))
    }
}

/// Command line flags.
#[derive(clap::Parser, Debug)]
struct NewElectionArgs {
    #[clap(
        long = "admin",
        help = "Path to the file containing the Concordium account keys exported from the wallet. \
                This will be the admin account of the election."
    )]
    admin:                std::path::PathBuf,
    #[clap(
        long = "module",
        help = "Path of the Concordium smart contract module."
    )]
    module:               std::path::PathBuf,
    #[arg(
        long = "base-url",
        help = "Base url where the election data is accessible. This is recorded in the contract."
    )]
    base_url:             url::Url,
    #[arg(
        long = "election-start",
        help = "The start time of the election. The format is ISO-8601, e.g. 2024-01-23T12:13:14Z."
    )]
    election_start:       chrono::DateTime<chrono::Utc>,
    #[arg(
        long = "election-end",
        help = "The end time of the election. The format is ISO-8601, e.g. 2024-01-23T12:13:14Z."
    )]
    election_end:         chrono::DateTime<chrono::Utc>,
    #[arg(
        long = "decryption-deadline",
        help = "The deadline for guardians to register decryption shares. The format is ISO-8601, \
                e.g. 2024-01-23T12:13:14Z."
    )]
    decryption_deadline:  chrono::DateTime<chrono::Utc>,
    #[arg(
        long = "delegation-string",
        help = "The string to identify vote delegations."
    )]
    delegation_string:    String,
    #[arg(long = "guardian", help = "The account addresses of guardians..")]
    guardians:            Vec<AccountAddress>,
    #[arg(
        long = "threshold",
        help = "Threshold for the number of guardians needed."
    )]
    threshold:            u32,
    #[arg(
        long = "candidate",
        help = "The URL to candidates metadata. The order matters."
    )]
    candidates:           Vec<CandidateLocation>,
    #[clap(long = "out", help = "Path where files produced are written to")]
    out:                  std::path::PathBuf,
    #[clap(
        long = "voters-file",
        help = "Path to the file with a list of eligible accounts with their weights."
    )]
    voters_file:          std::path::PathBuf,
    #[clap(
        long = "voters-params-file",
        help = "Path to the file containing the parameters used to generate the `voters-file`."
    )]
    voters_params_file:   std::path::PathBuf,
    #[clap(
        long = "description",
        help = "A descriptive title of the election. This is ideally short as it is used in \
                applications as a title."
    )]
    election_description: String,
}

#[derive(Debug, clap::Subcommand)]
enum InitialWeights {
    /// Verify the weights registered in the contract
    #[command(name = "verify")]
    Verify {
        #[arg(
            long = "contract",
            help = "Address of the election contract in the format <index, subindex>."
        )]
        contract: ContractAddress,
    },
    /// Generate initial weights from parameters
    #[command(name = "generate")]
    Generate(InitialWeightsArgs),
}

#[derive(Debug, clap::Subcommand)]
enum Command {
    /// Create a new smart contract instance, together with election parameters.
    #[command(name = "new-election")]
    NewElection(Box<NewElectionArgs>),
    /// For each account compute the average amount of CCD held
    /// during the period.
    #[command(name = "initial-weights")]
    InitialWeights {
        #[arg(long = "out", help = "Directory to output data into.")]
        out:     std::path::PathBuf,
        #[command(subcommand)]
        command: InitialWeights,
    },
    /// Look for delegations of the vote during the election period.
    #[command(name = "final-weights")]
    FinalWeights {
        #[arg(
            long = "out",
            help = "File to output auxiliary data into. For each account there is a list of \
                    delegators for that account. This is different from the final weights file \
                    which contains only the summary."
        )]
        out:             Option<std::path::PathBuf>,
        #[arg(
            long = "contract",
            help = "Address of the election contract in the format <index, subindex>."
        )]
        contract:        ContractAddress,
        #[arg(long = "initial-weights", help = "The CSV file with initial weights.")]
        initial_weights: std::path::PathBuf,
        #[arg(
            long = "final-weights",
            help = "Location where to write the final weights."
        )]
        final_weights:   std::path::PathBuf,
    },
    /// Tally all the votes.
    #[command(name = "tally")]
    Tally(#[clap(flatten)] TallyArgs),
    /// Compute and optionally post the final result of the election in the
    /// contract.
    FinalResult {
        #[arg(
            long = "contract",
            help = "Address of the election contract in the format <index, subindex>"
        )]
        contract:    ContractAddress,
        #[arg(
            long = "admin-keys",
            help = "Location of the keys used to register election results in the contract."
        )]
        wallet_path: Option<std::path::PathBuf>,
    },
    /// Reset finalization phase.
    Reset {
        #[arg(
            long = "contract",
            help = "Address of the election contract in the format <index, subindex>"
        )]
        contract:            ContractAddress,
        #[arg(
            long = "admin-keys",
            help = "Location of the keys used to register election results in the contract."
        )]
        wallet_path:         std::path::PathBuf,
        #[arg(
            long = "guardian",
            help = "The account addresses of guardians to be excluded."
        )]
        guardians:           Vec<AccountAddress>,
        #[arg(
            long = "decryption-deadline",
            help = "The new deadline for guardians to register decryption shares. The format is \
                    ISO-8601, e.g. 2024-01-23T12:13:14Z."
        )]
        decryption_deadline: chrono::DateTime<chrono::Utc>,
    },
    ElectionStats {
        #[arg(
            long = "contract",
            help = "Address of the election contract in the format <index, subindex>"
        )]
        contract:        ContractAddress,
        #[arg(long = "initial-weights", help = "The CSV file with initial weights.")]
        initial_weights: std::path::PathBuf,
        #[arg(long = "final-weights", help = "The CSV file with final weights.")]
        final_weights:   std::path::PathBuf,
        #[arg(long = "out", help = "Location where to write the statistics result.")]
        out:             std::path::PathBuf,
    },
}

#[derive(Debug, Parser)]
struct TallyArgs {
    #[arg(
        long = "contract",
        help = "Address of the election contract in the format <index, subindex>."
    )]
    target_address: ContractAddress,
    #[arg(
        long = "final-weights",
        help = "Location of the file with final weights of accounts."
    )]
    final_weights:  std::path::PathBuf,
    #[arg(
        long = "admin-keys",
        help = "Location of the keys used to register election results in the contract."
    )]
    keys:           Option<std::path::PathBuf>,
}

#[derive(Debug, clap::Parser)]
struct InitialWeightsArgs {
    #[arg(
        long = "start",
        help = "The start time of the collection. This is inclusive. The format is ISO-8601, e.g. \
                2024-01-23T12:13:14Z."
    )]
    start: chrono::DateTime<chrono::Utc>,
    #[arg(
        long = "end",
        help = "The end time of the collection. This is also inclusive. The format is ISO-8601, \
                e.g. 2024-01-23T12:13:14Z."
    )]
    end:   chrono::DateTime<chrono::Utc>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let app: Args = Args::parse();
    let endpoint = if app
        .node_endpoint
        .uri()
        .scheme()
        .map_or(false, |x| x == &sdk::Scheme::HTTPS)
    {
        app.node_endpoint
            .tls_config(tonic::transport::channel::ClientTlsConfig::new())
            .context("Unable to construct TLS configuration for the Concordium API.")?
    } else {
        app.node_endpoint
    }
    .connect_timeout(std::time::Duration::from_secs(5))
    .timeout(std::time::Duration::from_secs(10));

    match app.command {
        Command::InitialWeights { out, command } => {
            handle_initial_weights(endpoint, command, out).await
        }
        Command::FinalWeights {
            out,
            contract,
            initial_weights,
            final_weights,
        } => handle_final_weights(endpoint, out, contract, initial_weights, final_weights).await,
        Command::Tally(tally) => handle_tally(endpoint, tally).await,
        Command::FinalResult {
            contract,
            wallet_path,
        } => handle_decrypt(endpoint, contract, wallet_path).await,
        Command::NewElection(args) => handle_new_election(endpoint, *args).await,
        Command::Reset {
            contract,
            wallet_path,
            guardians,
            decryption_deadline,
        } => {
            handle_reset(
                endpoint,
                contract,
                wallet_path,
                guardians,
                decryption_deadline.try_into()?,
            )
            .await
        }
        Command::ElectionStats {
            contract,
            initial_weights,
            final_weights,
            out,
        } => handle_election_stats(endpoint, contract, initial_weights, final_weights, out).await,
    }
}

/// Find a payday block starting at the given block. The block is found by
/// moving through epochs until a payday block is found. If `search_backwards`
/// is true then the block searched for is the last payday block before the
/// given block, otherwise it is the first payday block after the given block.
///
/// # Arguments
/// * `client` - The SDK client to use for querying the chain
/// * `block` - The block to start searching from
/// * `search_backwards` - Whether to search backwards or forwards from the
///   start block
///
/// # Returns
/// The first payday block found in the specified direction
///
/// # Errors
/// Returns an error if communication with the node fails
async fn find_payday_block(
    client: &mut sdk::Client,
    block: BlockInfo,
    search_backwards: bool,
) -> anyhow::Result<BlockInfo> {
    let mut block = block;
    let mut epoch = Epoch {
        epoch: block.epoch.expect("Has protocol version 6 or above").epoch
            + if search_backwards { 0 } else { 1 },
    };

    while !client.is_payday_block(block.block_height).await?.response {
        epoch = Epoch {
            epoch: if search_backwards {
                epoch.epoch.saturating_sub(1)
            } else {
                epoch.epoch + 1
            },
        };
        let epoch = SpecifiedEpoch {
            epoch,
            genesis_index: block.genesis_index,
        };

        let block_height = client.get_first_block_epoch(epoch).await?;
        block = client.get_block_info(block_height).await?.response;
    }

    Ok(block)
}

/// Figure out which blocks to use as start and end blocks given the time range.
/// The return blocks are the first block no earlier than the start time, and
/// the last block no (strictly) later than the provided end time. If
/// `use_payday_blocks` is true, the start block will be the first payday block
/// after the start time.
async fn range_setup(
    client: &mut sdk::Client,
    start: chrono::DateTime<chrono::Utc>,
    end: chrono::DateTime<chrono::Utc>,
    use_payday_blocks: bool,
) -> anyhow::Result<(BlockInfo, BlockInfo)> {
    anyhow::ensure!(
        start < end,
        "Need a non-empty interval to index. The start time must be earlier than end time."
    );
    let info = client
        .get_block_info(BlockIdentifier::LastFinal)
        .await?
        .response;
    anyhow::ensure!(
        end <= info.block_slot_time,
        "End time not before the last finalized block."
    );

    let mut first_block = client
        .find_first_finalized_block_no_earlier_than(.., start)
        .await?;
    let mut last_block = {
        let last_block = client
            .find_first_finalized_block_no_earlier_than(.., end)
            .await?;
        if last_block.block_slot_time > end {
            let height = last_block
                .block_height
                .height
                .checked_sub(1)
                .context("Unable to end before genesis.")?;
            client
                .get_block_info(AbsoluteBlockHeight::from(height))
                .await?
                .response
        } else {
            last_block
        }
    };

    if use_payday_blocks {
        // Find the first and last payday blocks within the bounds
        eprintln!("Searching for payday block bounds");

        first_block = find_payday_block(client, first_block, false).await?;
        last_block = find_payday_block(client, last_block, true).await?;
    }

    eprintln!(
        "Indexing from block {} at {} until block {} at {}.",
        first_block.block_hash,
        first_block.block_slot_time,
        last_block.block_hash,
        last_block.block_slot_time
    );
    Ok((first_block, last_block))
}

#[derive(serde::Serialize, serde::Deserialize)]
struct DelegationRow {
    hash: TransactionHash,
    from: AccountAddress,
    to:   AccountAddress,
}

// Serde custom serialization/deserialization
mod serde_account_address_vec {
    use super::AccountAddress;
    use serde::{self, Deserialize, Deserializer, Serializer};

    // Serialize the Vec<AccountAddress> as a ";"-separated string
    pub fn serialize<S>(items: &[AccountAddress], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer, {
        let joined = items
            .iter()
            .map(|item| item.to_string())
            .collect::<Vec<_>>()
            .join(";");
        serializer.serialize_str(&joined)
    }

    // Deserialize a ";"-separated string into Vec<AccountAddress>
    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<AccountAddress>, D::Error>
    where
        D: Deserializer<'de>, {
        let s = String::deserialize(deserializer)?;
        if s.is_empty() {
            return Ok(Vec::new());
        }

        s.split(';')
            .map(|item| item.parse::<AccountAddress>())
            .collect::<Result<Vec<_>, _>>()
            .map_err(serde::de::Error::custom)
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
struct FinalWeightRow {
    account:    AccountAddress,
    amount:     Amount,
    #[serde(with = "serde_account_address_vec")]
    delegators: Vec<AccountAddress>,
}

/// Compute the final weights given the initial weights.
/// The time range is taken from the provided contract.
async fn handle_final_weights(
    endpoint: sdk::Endpoint,
    delegations_out: Option<std::path::PathBuf>,
    target_address: ContractAddress,
    initial_weights: std::path::PathBuf,
    final_weights_path: std::path::PathBuf,
) -> anyhow::Result<()> {
    let client = sdk::Client::new(endpoint.clone()).await?;

    let mut contract_client =
        contract_client::ContractClient::<ElectionContract>::create(client, target_address).await?;

    let config = get_election_data(&mut contract_client)
        .await
        .context("Unable to get election data.")?;

    let (first_block, last_block) =
        range_setup(&mut contract_client.client, config.start, config.end, false).await?;

    let traverse_config = indexer::TraverseConfig::new_single(endpoint, first_block.block_height);
    let (sender, mut receiver) = tokio::sync::mpsc::channel(20);
    let cancel_handle = tokio::spawn(traverse_config.traverse(indexer::TransactionIndexer, sender));

    let bar = ProgressBar::new(last_block.block_height.height - first_block.block_height.height)
        .with_style(ProgressStyle::with_template(
            "{spinner} {msg} {wide_bar} {pos}/{len}",
        )?);

    let mut mapping = BTreeMap::new();

    while let Some((block, txs)) = receiver.recv().await {
        bar.set_message(block.block_slot_time.to_string());
        bar.inc(1);
        if block.block_slot_time > config.end {
            drop(receiver);
            cancel_handle.abort();
            drop(cancel_handle);
            eprintln!("Done indexing");
            break;
        }
        for tx in txs {
            let BlockItemSummaryDetails::AccountTransaction(atx) = tx.details else {
                continue; // Ignore non-account transactions
            };
            let AccountTransactionEffects::AccountTransferWithMemo {
                amount: _,
                to,
                memo,
            } = atx.effects
            else {
                continue; // Only consider transfers with memo.
            };
            let Ok(value) = serde_cbor::from_slice::<String>(memo.as_ref()) else {
                continue; // invalid CBOR is ignored.
            };
            if value == config.delegation_string {
                // Override any previous mapping from the same account (accounting for aliases
                // as well)
                mapping.insert(AccountAddressEq::from(atx.sender), (tx.hash, to));
            }
        }
    }
    {
        let mut out_handle: csv::Writer<Box<dyn std::io::Write>> =
            if let Some(file) = delegations_out {
                csv::Writer::from_writer(Box::new(std::fs::File::create(file)?))
            } else {
                csv::Writer::from_writer(Box::new(std::io::stdout().lock()))
            };
        for (from, (hash, to)) in &mapping {
            out_handle.serialize(DelegationRow {
                hash: *hash,
                from: *from.as_ref(),
                to:   *to,
            })?;
        }
        out_handle.flush()?;
    }
    bar.finish_and_clear();

    let initial_weights = std::fs::File::open(initial_weights)?;
    let mut weights = csv::Reader::from_reader(std::io::BufReader::new(initial_weights));
    // For each initial account
    let mut final_weights = BTreeMap::new();
    for row in weights.deserialize() {
        let row: WeightRow = row?;
        if let Some((_hash, target)) = mapping.remove(row.account.as_ref()) {
            let weight = final_weights
                .entry(AccountAddressEq::from(target))
                .or_insert((Amount::zero(), Vec::new()));
            weight.0 += row.amount;
            weight.1.push(row.account);
        } else {
            let weight = final_weights
                .entry(AccountAddressEq::from(row.account))
                .or_insert((Amount::zero(), Vec::new()));
            weight.0 += row.amount;
        }
    }

    {
        let mut out_handle = csv::Writer::from_path(final_weights_path)?;
        for (addr, (amount, delegators)) in final_weights {
            out_handle.serialize(FinalWeightRow {
                account: AccountAddress::from(addr),
                amount,
                delegators,
            })?;
        }
        out_handle.flush()?;
    }

    Ok(())
}

enum ElectionContract {}

/// Handle decryption of the final result, and checking or publishing the result
/// in the contract.
async fn handle_decrypt(
    endpoint: sdk::Endpoint,
    contract: ContractAddress,
    wallet_path: Option<std::path::PathBuf>,
) -> anyhow::Result<()> {
    let client = sdk::Client::new(endpoint.clone()).await?;
    let mut contract_client =
        contract_client::ContractClient::<ElectionContract>::create(client, contract).await?;

    let mut guardians_state = contract_client
        .view::<_, contract::GuardiansState, ViewError>(
            "viewGuardiansState",
            &(),
            BlockIdentifier::LastFinal,
        )
        .await?;
    let election_data = get_election_data(&mut contract_client).await?;
    let mut decryption_shares = Vec::new();
    let mut proof_shares = Vec::new();

    let encrypted_tally = contract_client
        .view::<(), Option<Vec<u8>>, ViewError>(
            "viewEncryptedTally",
            &(),
            BlockIdentifier::LastFinal,
        )
        .await?;
    let Some(encrypted_tally) = encrypted_tally else {
        anyhow::bail!("Encrypted tally not yet registered.")
    };

    let Ok(tally) = decode::<EncryptedTally>(&encrypted_tally) else {
        anyhow::bail!("Encrypted tally is not readable.")
    };

    guardians_state.sort_by_key(|g| g.1.index);

    for (guardian_address, guardian_state) in guardians_state {
        if let (Some(share), Some(proof)) = (
            guardian_state.decryption_share,
            guardian_state.decryption_share_proof,
        ) {
            let Ok(share) = decode::<GuardianDecryption>(&share) else {
                eprintln!("The decryption share registered by {guardian_address} is not readable.");
                continue;
            };
            let Ok(proof) = decode::<GuardianDecryptionProof>(&proof) else {
                eprintln!("The decryption proof response share registered by {guardian_address} is not readable.");
                continue;
            };
            decryption_shares.push(share);
            proof_shares.push(proof);
        }
    }
    let quorum = election_data
        .parameters
        .varying_parameters
        .k
        .get_one_based_usize();
    anyhow::ensure!(
        decryption_shares.len() >= quorum,
        "Not enough shares. Require {quorum} but only have {}.",
        decryption_shares.len()
    );

    eprintln!(
        "{} decryption shares available. Starting decryption.",
        decryption_shares.len()
    );

    // Progress bar for decryption.
    let bar = ProgressBar::new(tally.values().map(|x| x.len()).sum::<usize>() as u64).with_style(
        ProgressStyle::with_template("{spinner} {msg} {wide_bar} {pos}/{len}")?,
    );
    // spin the spinner automatically since we can't tick it during decryption of an
    // individual ciphertext
    bar.enable_steady_tick(std::time::Duration::from_millis(100));

    let mut decryption = {
        let mut decrypted_tallies = BTreeMap::new();
        for (contest, ciphertexts) in tally.into_iter() {
            let mut ciphers = Vec::new();
            for (i, ciphertext) in ciphertexts.into_iter().enumerate() {
                bar.set_message(format!("ciphertext {i} (contest {contest})"));
                bar.inc(1);
                // each guardian provides a decryption share of each of the options
                // for each of the contests.
                let mut decryption_shares_for_option = Vec::new();
                for guardian_shares in &decryption_shares {
                    let Some(decryption_share) = guardian_shares.get(&contest) else {
                        anyhow::bail!("Missing decryption share for contest {contest}");
                    };
                    let Some(share) = decryption_share.get(i) else {
                        anyhow::bail!(
                            "Missing decryption share for contest {contest} and option {i}"
                        );
                    };
                    decryption_shares_for_option.push(share);
                }
                let mut proof_shares_for_option = Vec::new();
                for proof_shares in &proof_shares {
                    let Some(proof_share) = proof_shares.get(&contest) else {
                        anyhow::bail!("Missing proof share for contest {contest}");
                    };
                    let Some(share) = proof_share.get(i) else {
                        anyhow::bail!("Missing proof share for contest {contest} and option {i}");
                    };
                    proof_shares_for_option.push(share);
                }

                let decrypted = VerifiableDecryption::compute(
                    &election_data.manifest,
                    &election_data.parameters,
                    &election_data.guardian_public_keys,
                    &ciphertext,
                    decryption_shares_for_option,
                    proof_shares_for_option,
                )?;
                ciphers.push(decrypted);
            }
            decrypted_tallies.insert(contest, ciphers);
        }
        decrypted_tallies
    };
    bar.finish_and_clear();

    let contest = {
        let mut contests = election_data.manifest.contests.indices();
        let Some(contest) = contests.next() else {
            anyhow::bail!("Need a contest in manifest.");
        };
        anyhow::ensure!(
            contests.next().is_none(),
            "Only a single contest is supported."
        );
        contest
    };

    let weights = if let Some(results) = decryption.remove(&contest) {
        let mut weights: contract::PostResultParameter = Vec::with_capacity(results.len());
        for value in results {
            let weight = value.plain_text.value().to_u64_digits();
            anyhow::ensure!(weight.len() <= 1, "Weight must fit into a u64.");
            weights.push(weight.first().copied().unwrap_or(0));
        }
        weights
    } else if decryption.is_empty() {
        // no contests means we had no valid votes in the election.
        eprintln!("No valid votes in the election. All candidates get 0 votes.");
        vec![0u64; election_data.candidates.len()] // each candidate gets 0
                                                   // votes.
    } else {
        anyhow::bail!("Encryptions only exist for incorrect contests.");
    };

    {
        // Format results for display.
        let computed_results: Vec<contract::CandidateResult> = election_data
            .candidates
            .into_iter()
            .zip(&weights)
            .map(
                |(candidate, &cummulative_votes)| contract::CandidateResult {
                    candidate,
                    cummulative_votes,
                },
            )
            .collect();

        let json_repr: String = Vec::<contract::CandidateResult>::get_type()
            .to_json_string_pretty(&concordium_std::to_bytes(&computed_results))
            .context("Unable to convert to String")?;
        eprintln!("The computed election results are.");
        println!("{json_repr}");
    }

    let current_result = contract_client
        .view::<_, contract::ViewElectionResultQueryResponse, ViewError>(
            "viewElectionResult",
            &(),
            BlockIdentifier::LastFinal,
        )
        .await?;

    if let Some(result) = current_result {
        let current_weights = result
            .iter()
            .map(|x| x.cummulative_votes)
            .collect::<Vec<_>>();
        if current_weights != weights {
            let json_repr: String = Vec::<contract::CandidateResult>::get_type()
                .to_json_string_pretty(&concordium_std::to_bytes(&result))
                .context("Unable to convert to String")?;
            eprintln!(
                "The election results are already published in the contract and are\n
                 {json_repr}."
            );
            let confirm = dialoguer::Confirm::new()
                .report(true)
                .wait_for_newline(true)
                .with_prompt("Do you want to overwrite the published results?")
                .interact()?;
            anyhow::ensure!(confirm, "Aborting.");
        } else {
            eprintln!(
                "The election results are already registered in the contract, and they match. \
                 Terminating."
            );
            return Ok(());
        }
    }

    if let Some(wallet_path) = wallet_path {
        let wallet = WalletAccount::from_json_file(wallet_path)?;
        let dry_run = contract_client
            .dry_run_update::<_, ViewError>(
                "postElectionResult",
                Amount::zero(),
                wallet.address,
                &weights,
            )
            .await
            .context("Failed to dry run")?;

        let handle = dry_run.send(&wallet).await?;

        if let Err(e) = handle.wait_for_finalization().await {
            eprintln!("Transaction failed with {e:#?}");
        } else {
            eprintln!("Transaction successful and finalized.",);
        }
    } else {
        eprintln!(
            "The admin keys were not provided, the results are not going to be posted to the \
             contract.\nRun again with the `--admin-keys` option to do so. "
        )
    }

    Ok(())
}

async fn handle_reset(
    endpoint: sdk::Endpoint,
    contract: ContractAddress,
    wallet_path: std::path::PathBuf,
    guardians: Vec<AccountAddress>,
    decryption_deadline: Timestamp,
) -> anyhow::Result<()> {
    let client = sdk::Client::new(endpoint.clone()).await?;
    let mut contract_client =
        contract_client::ContractClient::<ElectionContract>::create(client, contract).await?;
    let wallet = WalletAccount::from_json_file(wallet_path)?;
    let parameter = (guardians, decryption_deadline);
    let dry_run = contract_client
        .dry_run_update::<_, ViewError>(
            "resetFinalizationPhase",
            Amount::zero(),
            wallet.address,
            &parameter,
        )
        .await
        .context("Failed to dry run")?;

    let guardians_state = contract_client
        .view::<_, contract::GuardiansState, ViewError>(
            "viewGuardiansState",
            &(),
            BlockIdentifier::LastFinal,
        )
        .await?;

    let guardians_state_filtered = guardians_state
        .iter()
        .filter(|(addr, _)| parameter.0.contains(addr));

    eprintln!("Guardians to be removed:");
    for (addr, st) in guardians_state_filtered {
        let Some(pk_bytes) = st.public_key.clone() else {
            anyhow::bail!("Public key not found for guardian with address {}", addr);
        };
        let pk = decode::<GuardianPublicKey>(&pk_bytes)
            .context("Failed to decode guardian public key.")?;
        let pk_json = serde_json::to_string_pretty(&pk.coefficient_commitments.0[0])?;
        eprintln!(
            "Guardian {} with address {} and public key {}",
            pk.i, addr, pk_json
        );
    }

    let confirm = dialoguer::Confirm::new()
        .report(true)
        .wait_for_newline(true)
        .with_prompt("Confirm tally decryption reset.")
        .interact()?;
    anyhow::ensure!(confirm, "Aborting.");

    let handle = dry_run.send(&wallet).await?;

    if let Err(e) = handle.wait_for_finalization().await {
        eprintln!("Transaction failed with {e:#?}");
    } else {
        eprintln!("Transaction successful and finalized.",);
    }

    Ok(())
}

/// Election data retrieved from the contract and processed.
struct ElectionData {
    manifest:             ElectionManifest,
    parameters:           ElectionParameters,
    guardian_public_keys: Vec<GuardianPublicKey>,
    candidates:           Vec<contract::ChecksumUrl>,
    start:                chrono::DateTime<chrono::Utc>,
    end:                  chrono::DateTime<chrono::Utc>,
    /// String that is used to detect delegations.
    delegation_string:    String,
}

impl ElectionData {
    pub fn verification_context(&self) -> anyhow::Result<PreVotingData> {
        PreVotingData::compute(
            self.manifest.clone(),
            self.parameters.clone(),
            &self.guardian_public_keys,
        )
    }
}

/// Retrieve the election data from the contract and data linked from the
/// contract.
async fn get_election_data(
    contract_client: &mut contract_client::ContractClient<ElectionContract>,
) -> anyhow::Result<ElectionData> {
    let config = contract_client
        .view::<_, contract::ElectionConfig, contract_client::ViewError>(
            "viewConfig",
            &(),
            BlockIdentifier::LastFinal,
        )
        .await?;
    let guardians = contract_client
        .view::<_, contract::GuardiansState, contract_client::ViewError>(
            "viewGuardiansState",
            &(),
            BlockIdentifier::LastFinal,
        )
        .await?;

    let start = config.election_start.try_into()?;
    let end = config.election_end.try_into()?;

    let client = HttpClient::try_create(5000)?;

    let election_manifest = client
        .get_json_resource_checked(&config.election_manifest)
        .await?;
    let election_parameters = client
        .get_json_resource_checked(&config.election_parameters)
        .await?;

    let mut guardian_public_keys = guardians
        .iter()
        .map(|(ga, gs)| {
            let bytes = gs
                .public_key
                .clone()
                .with_context(|| format!("No public key found for guardian {ga}"))?;
            let key: GuardianPublicKey = decode(&bytes)
                .with_context(|| format!("Failed to decode public key for guardian {ga}"))?;
            anyhow::Ok(key)
        })
        .collect::<Result<Vec<GuardianPublicKey>, _>>()
        .context("Could not deserialize guardian public key")?;

    // Sort to make sure the public keys are in the order of indices
    // since some verification commands depend on it.
    guardian_public_keys.sort_by_key(|g| g.i);

    Ok(ElectionData {
        manifest: election_manifest,
        parameters: election_parameters,
        candidates: config.candidates,
        guardian_public_keys,
        start,
        end,
        delegation_string: config.delegation_string,
    })
}

/// Handle tallying of votes during the election phase.
/// Note that this assumes access to final weights already.
async fn handle_tally(
    endpoint: sdk::Endpoint,
    TallyArgs {
        target_address,
        final_weights,
        keys,
    }: TallyArgs,
) -> anyhow::Result<()> {
    let client = sdk::Client::new(endpoint.clone()).await?;
    let mut contract_client =
        contract_client::ContractClient::<ElectionContract>::create(client, target_address).await?;

    let election_data = get_election_data(&mut contract_client).await?;

    let verification_context: PreVotingData = election_data.verification_context()?;

    let start = election_data.start;
    let end = election_data.end;

    let (first_block, last_block) =
        range_setup(&mut contract_client.client, start, end, false).await?;

    let traverse_config = indexer::TraverseConfig::new_single(endpoint, first_block.block_height);
    let (sender, mut receiver) = tokio::sync::mpsc::channel(20);
    let cancel_handle = tokio::spawn(traverse_config.traverse(
        indexer::ContractUpdateIndexer {
            target_address,
            entrypoint: OwnedEntrypointName::new_unchecked("registerVotes".into()),
        },
        sender,
    ));

    let bar = ProgressBar::new(last_block.block_height.height - first_block.block_height.height)
        .with_style(ProgressStyle::with_template(
            "{spinner} {msg} {wide_bar} {pos}/{len}",
        )?);

    let mut ballots = BTreeMap::new();

    while let Some((block, txs)) = receiver.recv().await {
        bar.set_message(block.block_slot_time.to_string());
        bar.inc(1);
        if block.block_slot_time > end {
            drop(receiver);
            cancel_handle.abort();
            drop(cancel_handle);
            eprintln!("Done indexing.");
            break;
        }

        let results = txs
            .into_par_iter()
            .flat_map(
                |indexer::ContractUpdateInfo {
                     execution_tree,
                     transaction_hash,
                     sender,
                     ..
                 }| {
                    let param = execution_tree.parameter();
                    let Ok(param) = concordium_std::from_bytes::<contract::RegisterVotesParameter>(
                        param.as_ref(),
                    ) else {
                        eprintln!("Unable to parse ballot from transaction {transaction_hash}");
                        return None;
                    };

                    let Ok(ballot) = decode::<BallotEncrypted>(&param.inner) else {
                        eprintln!("Unable to parse ballot from transaction {transaction_hash}");
                        return None;
                    };
                    Some((
                        ballot.verify(&verification_context),
                        sender,
                        ballot,
                        transaction_hash,
                    ))
                },
            )
            .collect_vec_list();

        for (verified, sender, ballot, transaction_hash) in results.into_iter().flatten() {
            if verified {
                // Replace any previous ballot from the sender.
                ballots.insert(AccountAddressEq::from(sender), (ballot, transaction_hash));
            } else {
                eprintln!("Vote in transaction {transaction_hash} is invalid.");
            }
        }
    }

    let mut final_weights =
        csv::Reader::from_path(final_weights).context("Unable to open final weights file.")?;

    let mut tally =
        eg::ballot::BallotTallyBuilder::new(&election_data.manifest, &election_data.parameters);
    for row in final_weights.deserialize() {
        let FinalWeightRow {
            account,
            amount,
            delegators,
        } = row?;
        if let Some((ballot, hash)) = ballots.remove(&AccountAddressEq::from(account)) {
            let factor = get_scaling_factor(&amount);
            let delegators = delegators
                .iter()
                .map(|d| d.to_string())
                .collect::<Vec<_>>()
                .join(";");
            eprintln!(
                "Scaling the ballot cast by transaction {hash} by a factor {factor}. Delegators \
                 {delegators}.",
            );
            tally.update(ballot.scale(
                &verification_context.parameters.fixed_parameters,
                &util::algebra::FieldElement::from(
                    factor,
                    &election_data.parameters.fixed_parameters.field,
                ),
            ));
        } // else the account did not vote, so nothing to do.
    }
    let tally = tally.finalize();

    let serialized_tally = encode(&tally)?;
    let param = concordium_std::OwnedParameter::from_serial(&serialized_tally)?;

    let json_param =
        contract::PostEncryptedTallyParameter::get_type().to_json_string_pretty(param.as_ref())?;
    eprintln!("The following JSON parameter can be used to record the tally in the contract.");
    println!("{}", json_param);

    let current_tally = contract_client
        .view::<(), Option<Vec<u8>>, ViewError>(
            "viewEncryptedTally",
            &(),
            BlockIdentifier::LastFinal,
        )
        .await?;

    let wrong_tally = if let Some(registered_tally) = current_tally {
        if registered_tally == serialized_tally {
            eprintln!(
                "The computed encrypted tally matches the tally already registered in the contract"
            );
            return Ok(());
        }
        eprintln!(
            "The encrypted tally is already registered in the contract, but it is different."
        );
        if keys.is_some() {
            let confirm = dialoguer::Confirm::new()
                .report(true)
                .wait_for_newline(true)
                .with_prompt("Do you want to overwrite the published tally?")
                .interact()?;
            anyhow::ensure!(confirm, "Aborting.");
        }
        true
    } else {
        false
    };

    if let Some(keys) = keys {
        let wallet = WalletAccount::from_json_file(keys)?;
        eprintln!("Registering tally in the smart contract.");
        let dry_run = contract_client
            .dry_run_update_raw::<ViewError>(
                "postEncryptedTally",
                Amount::zero(),
                wallet.address,
                param,
            )
            .await
            .context("Failed to dry run postEncryptedTally")?;

        let tx = dry_run
            .send(&wallet)
            .await
            .context("Failed to send transaction to post the tally.")?;
        eprintln!("Transaction {tx} sent. Await finalization.");
        if let Err(reason) = tx.wait_for_finalization().await {
            eprintln!("Transaction failed with {reason:#?}");
        } else {
            eprintln!("Transaction successful and finalized.");
        }
    } else if !wrong_tally {
        eprintln!(
            "The tally is currently not registered in the contract, and no keys were provided."
        );
    }
    Ok(())
}

/// Handle collection of initial weights.
async fn handle_initial_weights(
    endpoint: sdk::Endpoint,
    args: InitialWeights,
    out: std::path::PathBuf,
) -> anyhow::Result<()> {
    ensure!(out.is_dir(), "out argument must point to a directory");

    // Get the balance of each account for each payday block
    let start_time = std::time::Instant::now();

    let mut client = sdk::Client::new(endpoint.clone())
        .await
        .context("Unable to connect.")?;

    // Get the parameters needed to run the weight generation and possible
    // verification.
    let (start, end, registered_weights_hash) = match &args {
        InitialWeights::Generate(gen) => (gen.start, gen.end, None),
        InitialWeights::Verify { contract } => {
            let mut contract_client = contract_client::ContractClient::<ElectionContract>::create(
                client.clone(),
                *contract,
            )
            .await?;
            let config = contract_client
                .view::<_, contract::ElectionConfig, contract_client::ViewError>(
                    "viewConfig",
                    &(),
                    BlockIdentifier::LastFinal,
                )
                .await?;

            let start = config.eligible_voters.parameters.start_time.try_into()?;
            let end = config.eligible_voters.parameters.end_time.try_into()?;
            let hash = config.eligible_voters.data.hash;
            (start, end, Some(hash))
        }
    };

    // Variables used to hold the weight calculation data.
    let (first_block, last_block) = range_setup(&mut client, start, end, true).await?;
    eprintln!("block range: {:.2?}", start_time.elapsed());
    let initial_block_ident: BlockIdentifier = first_block.block_height.into();
    let initial_account_number = client
        .get_account_list(initial_block_ident)
        .await?
        .response
        .try_fold(0u64, |acc, _| async move { Ok(acc + 1) })
        .await?;
    let mut account_addresses = Vec::with_capacity(initial_account_number as usize);
    let mut account_balances = vec![Vec::new(); initial_account_number as usize]; // Account balance for each payday block.

    // Get initial account balances
    let bar = ProgressBar::new(initial_account_number).with_style(ProgressStyle::with_template(
        "{spinner} {msg} {wide_bar} {pos}/{len}",
    )?);

    eprintln!(
        "Getting initial account balances in block {}.",
        first_block.block_hash
    );

    let tasks: Vec<_> = account_balances
        .iter_mut()
        .enumerate()
        .map(|(ai, _)| {
            let mut client = client.clone();
            let bar = bar.clone();

            async move {
                let info = client
                    .get_account_info(&AccountIndex::from(ai as u64).into(), initial_block_ident)
                    .await?;

                bar.set_message(info.response.account_address.to_string());
                bar.inc(1);

                Ok::<_, anyhow::Error>((
                    ai,
                    info.response.account_address,
                    info.response.account_amount,
                ))
            }
        })
        .collect();
    for result in join_all(tasks).await {
        let (ai, address, amount) = result?;
        account_addresses.push(address);
        account_balances[ai].push((first_block.block_slot_time, amount));
    }

    bar.finish_and_clear();
    drop(bar);
    eprintln!("initial account balances: {:.2?}", start_time.elapsed());

    // Get the balance of each account for each payday block
    let bar = ProgressBar::new(last_block.block_height.height - first_block.block_height.height)
        .with_style(ProgressStyle::with_template(
            "{spinner} {msg} {wide_bar} {pos}/{len}",
        )?);

    let traverse_config = indexer::TraverseConfig::new_single(endpoint, first_block.block_height);
    let (sender, mut receiver) = tokio::sync::mpsc::channel(20);
    let cancel_handle = tokio::spawn(traverse_config.traverse(indexer::BlockEventsIndexer, sender));
    let mut affected = BTreeSet::new();

    while let Some((block, normal, specials)) = receiver.recv().await {
        if block.block_height > last_block.block_height {
            drop(receiver);
            eprintln!("Done indexing");
            break;
        }
        bar.set_message(block.block_slot_time.to_string());
        bar.inc(1);

        // First collect the affected addresses within the payday
        for tx in normal {
            for addr in tx.affected_addresses() {
                affected.insert(AccountAddressEq::from(addr));
            }
        }
        for special in &specials {
            for addr in special.affected_addresses() {
                affected.insert(AccountAddressEq::from(addr));
            }
        }

        // Check if the block is a payday block by going through the special transaction
        // events. If not, then skip the block.
        let has_payday_event = specials.iter().any(|special| {
            matches!(
                special,
                SpecialTransactionOutcome::PaydayPoolReward { .. }
                    | SpecialTransactionOutcome::PaydayAccountReward { .. }
                    | SpecialTransactionOutcome::PaydayFoundationReward { .. }
            )
        });
        if !has_payday_event {
            continue;
        };

        // Then for all the affected accounts, add their balances for the payday
        let payday_block_ident = BlockIdentifier::from(block.block_height);
        let tasks = affected.iter().map(|acc| {
            let mut client = client.clone();
            async move {
                let info = client
                    .get_account_info(&AccountAddress::from(*acc).into(), payday_block_ident)
                    .await?
                    .response;
                let index = info.account_index.index as usize;

                Ok::<_, anyhow::Error>((index, info.account_address, info.account_amount))
            }
        });
        for result in join_all(tasks).await {
            let (index, account_address, account_amount) = result?;

            if let Some(elem) = account_balances.get_mut(index) {
                elem.push((block.block_slot_time, account_amount));
            } else {
                // Find all new accounts created between the last recorded account in
                // `account_addresses` and the account identified by `index`.
                let tasks = (account_addresses.len()..index).map(|idx| {
                    let mut client = client.clone();
                    async move {
                        let idx_acc = client
                            .get_account_info(
                                &AccountIndex::from(idx as u64).into(),
                                &payday_block_ident,
                            )
                            .await?;
                        Ok::<_, anyhow::Error>(idx_acc.response.account_address)
                    }
                });

                // Record the new accounts
                for result in join_all(tasks).await {
                    let account_address = result?;
                    account_addresses.push(account_address);
                    // Newly created accounts have balance 0 at the start of the period.
                    account_balances.push(vec![(first_block.block_slot_time, Amount::zero())]);
                }
                // Finally, record the data for the account identified by `index`
                account_addresses.push(account_address);
                account_balances.push(vec![
                    (first_block.block_slot_time, Amount::zero()),
                    (block.block_slot_time, account_amount),
                ]);
            }
        }

        // Reset the affected accounts for the subsequent payday.
        affected = BTreeSet::new();
    }

    cancel_handle.abort();
    bar.finish_and_clear();

    anyhow::ensure!(
        account_addresses.len() == account_balances.len(),
        "Expecting addresses match account balances. This is a bug."
    );

    eprintln!("indexed account balances: {:.2?}", start_time.elapsed());

    // Calculate the average weight for each account.
    let mut data = vec![];
    {
        let mut weights = csv::Writer::from_writer(&mut data);
        for (balances, address) in account_balances.into_iter().zip(account_addresses) {
            let Some((&first, rest)) = balances.split_first() else {
                anyhow::bail!("A bug, there should always be at least one reading.");
            };
            let mut last_time = first.0;
            let mut weighted_sum = u128::from(first.1.micro_ccd);
            let mut last_balance = weighted_sum;
            for &(dt, balance) in rest {
                weighted_sum +=
                    (dt.signed_duration_since(last_time).num_milliseconds() as u128) * last_balance;
                last_time = dt;
                last_balance = u128::from(balance.micro_ccd);
            }
            weighted_sum += (last_block
                .block_slot_time
                .signed_duration_since(last_time)
                .num_milliseconds() as u128)
                * last_balance;
            let amount = weighted_sum
                / (last_block
                    .block_slot_time
                    .signed_duration_since(first_block.block_slot_time)
                    .num_milliseconds() as u128);
            let amount = Amount::from_micro_ccd(amount as u64);
            weights.serialize(WeightRow {
                account: address,
                amount,
            })?;
        }
        weights.flush()?;
    }

    eprintln!("processed account weights: {:.2?}", start_time.elapsed());

    let mut weights_out = std::fs::File::create(out.join("initial-weights.csv"))
        .context("Failed to create weights file")?;
    weights_out
        .write(&data)
        .context("Failed to write initial weights to file")?;

    let mut params_out = std::fs::File::create(out.join("initial-weights-params.json"))
        .context("Failed to create weight params file")?;
    let params = contract::EligibleVotersParameters {
        start_time: Timestamp::from_timestamp_millis(start.timestamp_millis() as u64),
        end_time:   Timestamp::from_timestamp_millis(end.timestamp_millis() as u64),
    };
    params_out
        .write(&serde_json::to_vec(&params).expect("Serialization of params will not fail"))
        .context("Failed to write weight parameters to file")?;

    // Only runs if the `verify` subcommand is run.
    if let Some(registered_weights_hash) = registered_weights_hash {
        let hash = contract::HashSha2256(sha2::Sha256::digest(&data).into());
        ensure!(
            hash == registered_weights_hash,
            "The checksum registered in the contract does not match the computed hash: registered \
             {}, computed {}",
            &registered_weights_hash,
            &hash
        );
        println!("Succesfully verified the weights registered in the contract.");
    }

    Ok(())
}

#[derive(Debug, serde::Deserialize)]
/// Metadata of a candidate. We only need the name in this tool so we only model
/// that, and not the image and other parameters used by the frontend.
struct CandidateMetadata {
    name: String,
}

/// Create a new election instance.
async fn handle_new_election(endpoint: sdk::Endpoint, app: NewElectionArgs) -> anyhow::Result<()> {
    let mut client = sdk::Client::new(endpoint).await?;

    let wallet = WalletAccount::from_json_file(app.admin)?;

    let wasm_module = WasmModule::from_file(&app.module).context("Unable to read module.")?;
    let module_ref = wasm_module.get_module_ref();
    let existing_module = client
        .get_module_source(&module_ref, BlockIdentifier::LastFinal)
        .await;
    match existing_module {
        Ok(_) => {
            eprintln!("Module {module_ref} already exists.");
        }
        Err(e) if e.is_not_found() => {
            let nonce = client
                .get_next_account_sequence_number(&wallet.address)
                .await?;
            let tx = transactions::send::deploy_module(
                &wallet,
                wallet.address,
                nonce.nonce,
                TransactionTime::hours_after(1),
                wasm_module,
            );
            let hash = client.send_account_transaction(tx).await?;
            let (block_hash, result) = client
                .wait_until_finalized(&hash)
                .await
                .context("Module deployment failed.")?;
            anyhow::ensure!(result.is_success(), "Transaction failed {result:#?}");
            eprintln!("Module {module_ref} deployed in block {block_hash}");
        }
        Err(err) => anyhow::bail!("Could not inspect module status: {err}"),
    }

    let url = &app.base_url;
    let make_url = move |path: String| -> anyhow::Result<String> {
        let url = url.clone();
        let url = url.join(&path).context("Failed to construct URL")?;
        Ok(url.to_string())
    };

    anyhow::ensure!(
        !app.guardians.is_empty(),
        "The set of guardians must have at least one address."
    );

    anyhow::ensure!(
        !app.candidates.is_empty(),
        "There must be at least one candidate."
    );

    // Construct the manifest and candidates.
    let (options, candidates) = {
        let mut candidates = Vec::with_capacity(app.candidates.len());
        let mut options = Vec::with_capacity(app.candidates.len());
        for candidate in app.candidates {
            let (candidate_url, data) = match candidate {
                CandidateLocation::Remote(url) => {
                    let candidate_url = url.to_string();
                    let r = reqwest::get(url)
                        .await
                        .context("Unable to get data for candidate.")?;

                    anyhow::ensure!(r.status().is_success(), "Unable to get data for candidate.");
                    let data: Vec<_> = r.bytes().await?.into();

                    (candidate_url, data)
                }
                CandidateLocation::Disk(path) => {
                    let candidate_file = path
                        .file_name()
                        .and_then(OsStr::to_str)
                        .with_context(|| format!("Invalid filename for path {:?}", &path))?;
                    let candidate_url = make_url(format!("candidates/{}", candidate_file))?;
                    let data =
                        std::fs::read(&path).with_context(|| "Unable to candidate file {path}.")?;

                    (candidate_url, data)
                }
            };

            let hash = contract::HashSha2256(sha2::Sha256::digest(&data).into());
            candidates.push(contract::ChecksumUrl {
                url: candidate_url,
                hash,
            });
            let candidate_meta = serde_json::from_slice::<CandidateMetadata>(&data)
                .context("Unable to parse guardian's information")?;
            options.push(eg::election_manifest::ContestOption {
                label: candidate_meta.name,
            });
        }
        (options, candidates)
    };

    let manifest_hash = {
        let contest = eg::election_manifest::Contest {
            label:           "Governance committee member".into(),
            selection_limit: options.len(),
            options:         options.try_into()?,
        };

        let manifest = eg::election_manifest::ElectionManifest {
            label:         "Governance commitee election 2024 election manifest".into(),
            contests:      [contest].try_into()?,
            ballot_styles: [eg::ballot_style::BallotStyle {
                label:    "Governance committee vote".into(),
                contests: [ContestIndex::from_one_based_index_const(1).unwrap()].into(),
            }]
            .try_into()?,
        };
        let manifest_json = serde_json::to_vec_pretty(&manifest)?;
        let digest: [u8; 32] = sha2::Sha256::digest(&manifest_json).into();
        let manifest_path = app.out.join("election-manifest.json");
        std::fs::write(manifest_path, manifest_json)?;
        contract::HashSha2256(digest)
    };

    let parameters_hash = {
        let n = GuardianIndex::from_one_based_index(app.guardians.len().try_into()?)
            .context("Need at least one guardian.")?;

        let k = GuardianIndex::from_one_based_index_const(app.threshold)
            .context("Threshold must be at least 1.")?;
        anyhow::ensure!(
            k <= n,
            "Threshold must be less than total number of guardians."
        );

        let parameters = eg::election_parameters::ElectionParameters {
            fixed_parameters:   eg::standard_parameters::STANDARD_PARAMETERS.clone(),
            varying_parameters: eg::varying_parameters::VaryingParameters {
                n,
                k,
                date: chrono::Utc::now(),
                info: format!(
                    "Governance committee election from {} to {} with {k} out of {n} threshold.",
                    app.election_start, app.election_end
                ),
                ballot_chaining: eg::varying_parameters::BallotChaining::Prohibited,
            },
        };
        let parameters_json = serde_json::to_vec_pretty(&parameters)?;
        let digest: [u8; 32] = sha2::Sha256::digest(&parameters_json).into();
        let parameters_path = app.out.join("election-parameters.json");
        std::fs::write(parameters_path, parameters_json)?;
        contract::HashSha2256(digest)
    };

    let eligible_voters_hash = {
        let data = std::fs::read(&app.voters_file).context("Unable to read voters file.")?;
        contract::HashSha2256(sha2::Sha256::digest(data).into())
    };

    let eligible_voters_filename = app
        .voters_file
        .file_name()
        .context("voters-file must be a path to a file")?
        .to_str()
        .context("voters-file path is not valid unicode")?
        .to_string();
    let voters_params_file = std::fs::File::open(app.voters_params_file)
        .context("Failed to open `voters-params-file`.")?;
    let voters_params: contract::EligibleVotersParameters =
        serde_json::from_reader(&voters_params_file)
            .context("Failed to deserialize voters params")?;

    let init_param = contract::InitParameter {
        admin_account: wallet.address,
        candidates,
        guardians: app.guardians,
        eligible_voters: contract::EligibleVoters {
            parameters: voters_params,
            data:       contract::ChecksumUrl {
                url:  make_url(eligible_voters_filename)?,
                hash: eligible_voters_hash,
            },
        },
        election_manifest: contract::ChecksumUrl {
            url:  make_url("election-manifest.json".to_string())?,
            hash: manifest_hash,
        },
        election_parameters: contract::ChecksumUrl {
            url:  make_url("election-parameters.json".to_string())?,
            hash: parameters_hash,
        },
        election_description: app.election_description,
        election_start: app.election_start.try_into()?,
        election_end: app.election_end.try_into()?,
        decryption_deadline: app.decryption_deadline.try_into()?,
        delegation_string: app.delegation_string,
    };

    let param = concordium_std::OwnedParameter::from_serial(&init_param)?; // Example
    let param_json = contract::InitParameter::get_type()
        .to_json_string_pretty(&concordium_std::to_bytes(&init_param))?;
    eprintln!("JSON parameter that will be used to initialize the contract.");
    println!("{}", param_json);

    let confirm = dialoguer::Confirm::new()
        .report(true)
        .wait_for_newline(true)
        .with_prompt("Do you want to initialize the contract?")
        .interact()?;
    anyhow::ensure!(confirm, "Aborting.");

    let payload = transactions::InitContractPayload {
        init_name: OwnedContractName::new("init_election".into())?,
        amount: Amount::from_micro_ccd(0),
        mod_ref: module_ref,
        param,
    };

    let nonce = client
        .get_next_account_sequence_number(&wallet.address)
        .await?;

    let at = transactions::send::init_contract(
        &wallet,
        wallet.address,
        nonce.nonce,
        TransactionTime::hours_after(1),
        payload,
        20_000.into(),
    );
    let tx_hash = client.send_account_transaction(at).await?;
    eprintln!("Submitted transaction with hash {tx_hash}.");
    let (_, result) = client
        .wait_until_finalized(&tx_hash)
        .await
        .context("Failed to initialize contract instance.")?;
    let result = result
        .contract_init()
        .context("Unexpected response from transaction.")?;

    eprintln!(
        "Deployed new contract instance with address {} using transaction hash {}.",
        result.address, tx_hash
    );
    Ok(())
}

fn serialize_delegated_weight<S>(
    delegated_weight: &HashMap<AccountAddress, Amount>,
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer, {
    let formatted = delegated_weight
        .iter()
        .map(|(delegator, weight)| format!("{}:{}", delegator, weight))
        .collect::<Vec<String>>()
        .join(";");

    serializer.serialize_str(&formatted)
}

#[derive(serde::Serialize)]
struct ElectionStatsRow {
    account:          AccountAddress,
    initial_weight:   Amount,
    final_weight:     Amount,
    #[serde(serialize_with = "serialize_delegated_weight")]
    delegated_weight: HashMap<AccountAddress, Amount>,
    voted:            bool,
    timestamp:        Option<chrono::DateTime<chrono::Utc>>,
}

async fn handle_election_stats(
    endpoint: sdk::Endpoint,
    contract: ContractAddress,
    initial_weights: std::path::PathBuf,
    final_weights: std::path::PathBuf,
    out: std::path::PathBuf,
) -> anyhow::Result<()> {
    let client = sdk::Client::new(endpoint.clone()).await?;
    let mut contract_client =
        contract_client::ContractClient::<ElectionContract>::create(client, contract).await?;

    let election_data = get_election_data(&mut contract_client).await?;

    let verification_context: PreVotingData = election_data.verification_context()?;

    let start = election_data.start;
    let end = election_data.end;

    let (first_block, last_block) =
        range_setup(&mut contract_client.client, start, end, false).await?;

    let traverse_config = indexer::TraverseConfig::new_single(endpoint, first_block.block_height);
    let (sender, mut receiver) = tokio::sync::mpsc::channel(20);
    let cancel_handle = tokio::spawn(traverse_config.traverse(
        indexer::ContractUpdateIndexer {
            target_address: contract,
            entrypoint:     OwnedEntrypointName::new_unchecked("registerVotes".into()),
        },
        sender,
    ));

    let bar = ProgressBar::new(last_block.block_height.height - first_block.block_height.height)
        .with_style(ProgressStyle::with_template(
            "{spinner} {msg} {wide_bar} {pos}/{len}",
        )?);

    let mut ballots = BTreeMap::new();

    while let Some((block, txs)) = receiver.recv().await {
        bar.set_message(block.block_slot_time.to_string());
        bar.inc(1);
        if block.block_slot_time > end {
            drop(receiver);
            cancel_handle.abort();
            drop(cancel_handle);
            eprintln!("Done indexing.");
            break;
        }

        let results = txs
            .into_par_iter()
            .flat_map(
                |indexer::ContractUpdateInfo {
                     execution_tree,
                     transaction_hash,
                     sender,
                     ..
                 }| {
                    let param = execution_tree.parameter();
                    let Ok(param) = concordium_std::from_bytes::<contract::RegisterVotesParameter>(
                        param.as_ref(),
                    ) else {
                        eprintln!("Unable to parse ballot from transaction {transaction_hash}");
                        return None;
                    };

                    let Ok(ballot) = decode::<BallotEncrypted>(&param.inner) else {
                        eprintln!("Unable to parse ballot from transaction {transaction_hash}");
                        return None;
                    };
                    Some((
                        ballot.verify(&verification_context),
                        sender,
                        ballot,
                        transaction_hash,
                        block.block_slot_time,
                    ))
                },
            )
            .collect_vec_list();

        for (verified, sender, ballot, transaction_hash, timestamp) in results.into_iter().flatten()
        {
            if verified {
                // Replace any previous ballot from the sender.
                ballots.insert(
                    AccountAddressEq::from(sender),
                    (ballot, transaction_hash, timestamp),
                );
            } else {
                eprintln!("Vote in transaction {transaction_hash} is invalid.");
            }
        }
    }

    let mut initial_weights =
        csv::Reader::from_path(initial_weights).context("Unable to open initial weights file.")?;
    let mut final_weights =
        csv::Reader::from_path(final_weights).context("Unable to open final weights file.")?;

    let mut weights_map = HashMap::new();
    for row in initial_weights.deserialize() {
        let WeightRow { account, amount } = row?;
        weights_map.insert(account, amount);
    }

    let mut out_file = std::fs::File::create(out)?;
    let mut writer = csv::Writer::from_writer(&mut out_file);
    for row in final_weights.deserialize() {
        let FinalWeightRow {
            account,
            amount: final_weight,
            delegators,
        } = row?;
        let (voted, timestamp) =
            if let Some((_, _, timestamp)) = ballots.remove(&AccountAddressEq::from(account)) {
                (true, Some(timestamp))
            } else {
                (false, None)
            };

        let initial_weight = weights_map.get(&account).copied().unwrap_or(Amount::zero());
        let delegated_weight = delegators
            .iter()
            .map(|delegator| {
                let delegator_weight = weights_map
                    .get(delegator)
                    .copied()
                    .unwrap_or(Amount::zero());
                (*delegator, delegator_weight)
            })
            .collect();

        let row = ElectionStatsRow {
            account,
            initial_weight,
            final_weight,
            delegated_weight,
            voted,
            timestamp,
        };
        writer.serialize(row)?;
    }

    writer.flush()?;
    Ok(())
}
