//! A tool for the election coordinator to gather data from the chain, and to
//! coordinate finalization of the election.

use anyhow::Context;
use clap::Parser;
use concordium_governance_committee_election as contract;
use concordium_rust_sdk::{
    base::transactions,
    common::types::TransactionTime,
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
        BlockItemSummaryDetails, ContractAddress, WalletAccount,
    },
    v2::{self as sdk, BlockIdentifier},
};
use concordium_std::schema::SchemaType;
use contract::GuardiansState;
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
    ByteConvert, ElectionEncryptedTally, GuardianDecryptionProofResponseShares,
    GuardianDecryptionShares,
};
use futures::TryStreamExt;
use indicatif::{ProgressBar, ProgressStyle};
use sha2::Digest as _;
use std::collections::{BTreeMap, BTreeSet};

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

/// Command line flags.
#[derive(clap::Parser, Debug)]
struct NewElectionArgs {
    #[clap(
        long = "admin",
        help = "Path to the file containing the Concordium account keys exported from the wallet. \
                This will be the admin account of the election."
    )]
    admin:             std::path::PathBuf,
    #[clap(
        long = "module",
        help = "Path of the Concordium smart contract module."
    )]
    module:            std::path::PathBuf,
    #[arg(
        long = "base-url",
        help = "Base url where the election data is accessible. This is recorded in the contract."
    )]
    base_url:          url::Url,
    #[arg(
        long = "election-start",
        help = "The start time of the election. The format is ISO-8601, e.g. 2024-01-23T12:13:14Z."
    )]
    election_start:    chrono::DateTime<chrono::Utc>,
    #[arg(
        long = "election-end",
        help = "The end time of the election. The format is ISO-8601, e.g. 2024-01-23T12:13:14Z."
    )]
    election_end:      chrono::DateTime<chrono::Utc>,
    #[arg(
        long = "delegation-string",
        help = "The string to identify vote delegations."
    )]
    delegation_string: String,
    #[arg(long = "guardian", help = "The account addresses of guardians..")]
    guardians:         Vec<AccountAddress>,
    #[arg(
        long = "threshold",
        help = "Threshold for the number of guardians needed."
    )]
    threshold:         u32,
    #[arg(
        long = "candidate",
        help = "The URL to candidates metadata. The order matters."
    )]
    candidates:        Vec<url::Url>,
    #[clap(
        long = "manifest-out",
        help = "Path where the election manifest file will be written."
    )]
    manifest_file:     std::path::PathBuf,
    #[clap(
        long = "parameters-out",
        help = "Path where election parameters will be output."
    )]
    parameters_file:   std::path::PathBuf,
    #[clap(
        long = "voters-file",
        help = "Path to the file with a list of eligible accounts with their weights."
    )]
    voters_file:       std::path::PathBuf,
}

#[derive(Debug, clap::Subcommand)]
enum Command {
    /// Create a new smart contract instance, together with election parameters.
    #[command(name = "new-election")]
    NewElection(Box<NewElectionArgs>),
    /// For each account compute the average amount of CCD held
    /// during the period.
    #[command(name = "initial-weights")]
    InitialWeights(RangeWithOutput),
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
struct RangeWithOutput {
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
    #[arg(long = "out", help = "File to output data into.")]
    out:   Option<std::path::PathBuf>,
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
        Command::InitialWeights(accds) => handle_initial_weights(endpoint, accds).await,
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
    }
}

/// Figure out which blocks to use as start and end blocks given the time range.
/// The return blocks are the first block no earlier than the start time, and
/// the last block no (strictly) later than the provided end time.
async fn range_setup(
    client: &mut sdk::Client,
    start: chrono::DateTime<chrono::Utc>,
    end: chrono::DateTime<chrono::Utc>,
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
    let first_block = client
        .find_first_finalized_block_no_earlier_than(.., start)
        .await?;

    let last_block = {
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
struct WeightRow {
    account: AccountAddress,
    amount:  Amount,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct DelegationRow {
    hash: TransactionHash,
    from: AccountAddress,
    to:   AccountAddress,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct FinalWeightRow {
    account:    AccountAddress,
    amount:     Amount,
    /// ';' separated list of accounts that delegated.
    delegators: String,
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
        range_setup(&mut contract_client.client, config.start, config.end).await?;

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
            let AccountTransactionEffects::AccountTransferWithMemo { amount: _, to, memo } = atx.effects else {
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
                delegators: delegators
                    .into_iter()
                    .map(|x| x.to_string())
                    .collect::<Vec<_>>()
                    .join(";"),
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
        .view::<_, GuardiansState, ViewError>("viewGuardiansState", &(), BlockIdentifier::LastFinal)
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

    let Ok(tally) = ElectionEncryptedTally::decode(&encrypted_tally) else {
        anyhow::bail!("Encrypted tally is not readable.")
    };

    guardians_state.sort_by_key(|g| g.1.index);

    for (guardian_address, guardian_state) in guardians_state {
        if let (Some(share), Some(proof)) = (
            guardian_state.decryption_share,
            guardian_state.decryption_share_proof,
        ) {
            let Ok(share) = GuardianDecryptionShares::decode(&share) else {
                eprintln!("The decryption share registered by {guardian_address} is not readable.");
                continue;
            };
            let Ok(proof) = GuardianDecryptionProofResponseShares::decode(&proof) else {
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
        .get_zero_based_usize();
    anyhow::ensure!(
        decryption_shares.len() >= quorum,
        "Not enough shares. Require {} but only have {quorum}.",
        decryption_shares.len()
    );

    let mut decryption = {
        let mut decrypted_tallies = BTreeMap::new();
        for (contest, ciphertexts) in tally.into_iter() {
            let mut ciphers = Vec::new();
            for (i, ciphertext) in ciphertexts.into_iter().enumerate() {
                // each guardian provides a decryption share of each of the options
                // for each of the contests.
                let mut decryption_shares_for_option = Vec::new();
                for guardian_shares in &decryption_shares {
                    let Some(decryption_share) = guardian_shares.get(&contest) else {
                        anyhow::bail!("Missing decryption share for contest {contest}");
                    };
                    let Some(share) = decryption_share.get(i) else {
                        anyhow::bail!("Missing decryption share for contest {contest} and option {i}");
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
    let Some(results) = decryption.remove(&contest) else {
        anyhow::bail!("No decryptions for contest.");
    };

    let mut weights: contract::PostResultParameter = Vec::with_capacity(results.len());
    for value in results {
        let weight = value.plain_text.to_u64_digits();
        eprintln!("{weight:?}");
        anyhow::ensure!(weight.len() <= 1, "Weight must fit into a u64.");
        weights.push(weight.first().copied().unwrap_or(0));
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
            eprintln!(
                "The election results are already registered in the contract are \
                 {current_weights:?}."
            );
            eprintln!("But the newly computed results are {weights:?}");
            let confirm = dialoguer::Confirm::new()
                .report(true)
                .wait_for_newline(true)
                .with_prompt("Do you want to overwrite the published results?")
                .interact()?;
            anyhow::ensure!(confirm, "Aborting.");
        } else {
            eprintln!(
                "The election results are already registered in the contract, and they match."
            );
            for option in result {
                println!("Option: {}", option.candidate.url);
                println!("Number of votes: {}", option.cummulative_votes);
            }
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
    }

    Ok(())
}

/// Election data retrieved from the contract and processed.
struct ElectionData {
    manifest:             ElectionManifest,
    parameters:           ElectionParameters,
    guardian_public_keys: Vec<GuardianPublicKey>,
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

    let start = config.election_start.try_into()?;
    let end = config.election_end.try_into()?;

    let election_manifest: ElectionManifest = {
        let response = reqwest::get(config.election_manifest.url)
            .await
            .context("Failed to get election manifest.")?;
        anyhow::ensure!(
            response.status().is_success(),
            "Failed to get election manifest, server responded with {}",
            response.status()
        );
        response
            .json()
            .await
            .context("Unable to parse election manifest.")?
    };
    let election_parameters: ElectionParameters = {
        let response = reqwest::get(config.election_parameters.url)
            .await
            .context("Failed to get election parameters.")?;
        anyhow::ensure!(
            response.status().is_success(),
            "Failed to get election parameters, server responded with {}",
            response.status()
        );
        response
            .json()
            .await
            .context("Unable to parse election parameters.")?
    };

    let mut guardian_public_keys = config
        .guardian_keys
        .iter()
        .map(|bytes| GuardianPublicKey::decode(bytes))
        .collect::<Result<Vec<GuardianPublicKey>, _>>()
        .context("Could not deserialize guardian public key")?;

    // Sort to make sure the public keys are in the order of indices
    // since some verification commands depend on it.
    guardian_public_keys.sort_by_key(|g| g.i);

    Ok(ElectionData {
        manifest: election_manifest,
        parameters: election_parameters,
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

    let (first_block, last_block) = range_setup(&mut contract_client.client, start, end).await?;

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

        for indexer::ContractUpdateInfo {
            execution_tree,
            transaction_hash,
            sender,
            ..
        } in txs
        {
            let param = execution_tree.parameter();
            let Ok(param) = concordium_std::from_bytes::<contract::RegisterVotesParameter>(param.as_ref()) else {
                eprintln!("Unable to parse ballot from transaction {transaction_hash}");
                continue;
            };

            let Ok(ballot) = BallotEncrypted::decode(&param) else {
                eprintln!("Unable to parse ballot from transaction {transaction_hash}");
                continue;
            };
            let verified = ballot.verify(
                &verification_context,
                eg::index::Index::from_one_based_index(1).unwrap(),
            );
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

    let mut tally = eg::ballot::BallotTallyBuilder::new(&election_data.manifest);
    for row in final_weights.deserialize() {
        let FinalWeightRow {
            account,
            amount,
            delegators,
        } = row?;
        if let Some((ballot, hash)) = ballots.remove(&AccountAddressEq::from(account)) {
            let factor = amount.micro_ccd() / 1_000_000u64;
            eprintln!(
                "Scaling the ballot cast by transaction {hash} by a factor {factor}. Delegators \
                 {delegators}."
            );
            tally.update(ballot.scale(
                &verification_context.parameters.fixed_parameters,
                factor.into(),
            ));
        } // else the account did not vote, so nothing to do.
    }
    let tally = tally.finalize();

    let serialized_tally = tally.encode()?;
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
    if let Some(registered_tally) = current_tally {
        if registered_tally == serialized_tally {
            eprintln!("The computed encrypted tally is already registered in the contract.");
        } else {
            eprintln!(
                "The encrypted tally is already registered in the contract, but it is different."
            );
        }
    } else if let Some(keys) = keys {
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
    } else {
        eprintln!(
            "The tally is currently not registered in the contract, and no keys were provided."
        );
    }
    Ok(())
}

/// Handle collection of initial weights.
async fn handle_initial_weights(
    endpoint: sdk::Endpoint,
    accds: RangeWithOutput,
) -> anyhow::Result<()> {
    let mut client = sdk::Client::new(endpoint.clone())
        .await
        .context("Unable to connect.")?;
    let (first_block, last_block) = range_setup(&mut client, accds.start, accds.end).await?;
    let initial_block_ident: BlockIdentifier = first_block.block_height.into();
    let initial_account_number = client
        .get_account_list(initial_block_ident)
        .await?
        .response
        .try_fold(0u64, |acc, _| async move { Ok(acc + 1) })
        .await?;
    let mut account_balances = vec![Vec::new(); initial_account_number as usize];
    let mut account_addresses = Vec::with_capacity(initial_account_number as usize);
    let bar = ProgressBar::new(initial_account_number).with_style(ProgressStyle::with_template(
        "{spinner} {msg} {wide_bar} {pos}/{len}",
    )?);

    eprintln!(
        "Getting initial account balances in block {}.",
        first_block.block_hash
    );
    for (ai, balances) in account_balances.iter_mut().enumerate() {
        let info = client
            .get_account_info(&AccountIndex::from(ai as u64).into(), initial_block_ident)
            .await?;
        account_addresses.push(info.response.account_address);
        bar.set_message(info.response.account_address.to_string());
        bar.inc(1);
        balances.push((first_block.block_slot_time, info.response.account_amount));
    }
    bar.finish_and_clear();
    drop(bar);
    let bar = ProgressBar::new(last_block.block_height.height - first_block.block_height.height)
        .with_style(ProgressStyle::with_template(
            "{spinner} {msg} {wide_bar} {pos}/{len}",
        )?);

    let traverse_config = indexer::TraverseConfig::new_single(endpoint, first_block.block_height);
    let (sender, mut receiver) = tokio::sync::mpsc::channel(20);
    let cancel_handle = tokio::spawn(traverse_config.traverse(indexer::BlockEventsIndexer, sender));
    while let Some((block, normal, specials)) = receiver.recv().await {
        if block.block_slot_time > accds.end {
            drop(receiver);
            eprintln!("Done indexing");
            break;
        }
        bar.set_message(block.block_slot_time.to_string());
        bar.inc(1);
        let mut affected = BTreeSet::new();
        for tx in normal {
            for addr in tx.affected_addresses() {
                affected.insert(AccountAddressEq::from(addr));
            }
        }
        for special in specials {
            for addr in special.affected_addresses() {
                affected.insert(AccountAddressEq::from(addr));
            }
        }
        let block_ident = BlockIdentifier::from(block.block_height);
        for acc in affected {
            let info = client
                .get_account_info(&AccountAddress::from(acc).into(), block_ident)
                .await?;
            let index = info.response.account_index.index as usize;
            if let Some(elem) = account_balances.get_mut(index) {
                elem.push((block.block_slot_time, info.response.account_amount));
            } else {
                // Newly created accounts have balance 0 at the start of the period.
                for idx in account_balances.len()..index {
                    account_balances.push(vec![(first_block.block_slot_time, Amount::zero())]);
                    let idx_acc = client
                        .get_account_info(&AccountIndex::from(idx as u64).into(), block_ident)
                        .await?;
                    account_addresses.push(idx_acc.response.account_address);
                }
                account_balances.push(vec![
                    (first_block.block_slot_time, Amount::zero()),
                    (block.block_slot_time, info.response.account_amount),
                ]);
                account_addresses.push(info.response.account_address);
            }
        }
    }
    cancel_handle.abort();
    bar.finish_and_clear();

    let mut out_handle: csv::Writer<Box<dyn std::io::Write>> = if let Some(file) = accds.out {
        csv::Writer::from_writer(Box::new(std::fs::File::create(file)?))
    } else {
        csv::Writer::from_writer(Box::new(std::io::stdout().lock()))
    };
    anyhow::ensure!(
        account_addresses.len() == account_balances.len(),
        "Expecting addresses match account balances. This is a bug."
    );
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
        out_handle.serialize(WeightRow {
            account: address,
            amount,
        })?;
    }
    out_handle.flush()?;
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
    let make_url = move |path| {
        let mut url = url.clone();
        url.set_path(path);
        url.to_string()
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
            let candidate_url = candidate.to_string();
            let r = reqwest::get(candidate)
                .await
                .context("Unable to get data for candidate.")?;
            anyhow::ensure!(r.status().is_success(), "Unable to get data for candidate.");
            let data = r.bytes().await?;
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
        std::fs::write(app.manifest_file, manifest_json)?;
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
                date: chrono::Utc::now().to_string(),
                info: format!(
                    "Governance committee election from {} to {} with {k} out of {n} threshold.",
                    app.election_start, app.election_end
                ),
                ballot_chaining: eg::varying_parameters::BallotChaining::Prohibited,
            },
        };
        let parameters_json = serde_json::to_vec_pretty(&parameters)?;
        let digest: [u8; 32] = sha2::Sha256::digest(&parameters_json).into();
        std::fs::write(app.parameters_file, parameters_json)?;
        contract::HashSha2256(digest)
    };

    let eligible_voters_hash = {
        let data = std::fs::read(app.voters_file).context("Unable to read voters file.")?;
        contract::HashSha2256(sha2::Sha256::digest(data).into())
    };

    let init_param = contract::InitParameter {
        admin_account: wallet.address,
        candidates,
        guardians: app.guardians,
        eligible_voters: contract::ChecksumUrl {
            url:  make_url("/static/concordium/eligible-voters.csv"),
            hash: eligible_voters_hash,
        },
        election_manifest: contract::ChecksumUrl {
            url:  make_url("static/electionguard/election-manifest.json"),
            hash: manifest_hash,
        },
        election_parameters: contract::ChecksumUrl {
            url:  make_url("static/electionguard/election-parameters.json"),
            hash: parameters_hash,
        },
        election_description: "Test election".into(),
        election_start: app.election_start.try_into()?,
        election_end: app.election_end.try_into()?,
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
