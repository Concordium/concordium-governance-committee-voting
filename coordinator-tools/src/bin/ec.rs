//! A tool for the election coordinator to gather data from the chain, and to
//! coordinate finalization of the election.

use anyhow::Context;
use clap::Parser;
use concordium_governance_committee_election as contract;
use concordium_rust_sdk::{
    common::types::TransactionTime,
    contract_client::{self, ContractTransactionMetadata, ViewError},
    indexer,
    smart_contracts::common::{
        self as concordium_std, AccountAddress, Amount, OwnedEntrypointName,
    },
    types::{
        hashes::TransactionHash, queries::BlockInfo, transactions::send::GivenEnergy,
        AbsoluteBlockHeight, AccountAddressEq, AccountIndex, AccountTransactionEffects,
        BlockItemSummaryDetails, ContractAddress, WalletAccount,
    },
    v2::{self as sdk, BlockIdentifier},
};
use concordium_std::schema::SchemaType;
use eg::{
    election_manifest::ElectionManifest, election_parameters::ElectionParameters,
    election_record::PreVotingData, guardian_public_key::GuardianPublicKey, hashes::Hashes,
    hashes_ext::HashesExt, joint_election_public_key::JointElectionPublicKey,
};
use futures::TryStreamExt;
use indicatif::{ProgressBar, ProgressStyle};
use std::collections::{BTreeMap, BTreeSet};

/// Command line configuration of the application.
#[derive(Debug, clap::Parser)]
struct Args {
    /// The node used for querying
    #[arg(
        long = "node",
        help = "The endpoints are expected to point to concordium node grpc v2 API's.",
        default_value = "http://localhost:20001",
        global = true
    )]
    node_endpoint: concordium_rust_sdk::v2::Endpoint,
    #[command(subcommand)]
    command:       Command,
}

#[derive(Debug, clap::Subcommand)]
enum Command {
    /// For each account compute the average amount of CCD held
    /// during the period.
    #[command(name = "initial-weights")]
    InitialWeights(RangeWithOutput),
    /// Look for delegations of the vote in the supplied period
    #[command(name = "final-weights")]
    FinalWeights {
        #[clap(flatten)]
        range:           RangeWithOutput,
        #[arg(
            long = "memo",
            help = "The memo to look for.",
            default_value = "Delegate vote for governance committee election"
        )]
        memo:            String,
        #[arg(long = "initial-weights", help = "The CSV file with initial weights.")]
        initial_weights: std::path::PathBuf,
        #[arg(
            long = "final-weights",
            help = "Location where to write the final weights."
        )]
        final_weights:   std::path::PathBuf,
    },
    /// Collect votes.
    #[command(name = "tally")]
    Tally(#[clap(flatten)] TallyArgs),
}

#[derive(Debug, Parser)]
struct TallyArgs {
    #[arg(long = "contract", help = "Address of the election contract.")]
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
        help = "The start time of the collection. This is inclusive."
    )]
    start: chrono::DateTime<chrono::Utc>,
    #[arg(
        long = "end",
        help = "The end time of the collection. This is also inclusive."
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
        Command::InitialWeights(accds) => handle_gather_average_balance(endpoint, accds).await,
        Command::FinalWeights {
            range,
            memo,
            initial_weights,
            final_weights,
        } => handle_final_weights(endpoint, range, memo, initial_weights, final_weights).await,
        Command::Tally(tally) => handle_vote_collection(endpoint, tally).await,
    }
}

async fn range_setup(
    endpoint: sdk::Endpoint,
    start: chrono::DateTime<chrono::Utc>,
    end: chrono::DateTime<chrono::Utc>,
) -> anyhow::Result<(sdk::Client, BlockInfo, BlockInfo)> {
    anyhow::ensure!(
        start < end,
        "Need a non-empty interval to index. The start time must be earlier than end time."
    );
    let mut client = sdk::Client::new(endpoint.clone()).await?;
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
    Ok((client, first_block, last_block))
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

async fn handle_final_weights(
    endpoint: sdk::Endpoint,
    accds: RangeWithOutput,
    expected_memo: String,
    initial_weights: std::path::PathBuf,
    final_weights_path: std::path::PathBuf,
) -> anyhow::Result<()> {
    let (_, first_block, last_block) =
        range_setup(endpoint.clone(), accds.start, accds.end).await?;

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
        if block.block_slot_time > accds.end {
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
            if value == expected_memo {
                // Override any previous mapping from the same account (accounting for aliases
                // as well)
                mapping.insert(AccountAddressEq::from(atx.sender), (tx.hash, to));
            }
        }
    }
    {
        let mut out_handle: csv::Writer<Box<dyn std::io::Write>> = if let Some(file) = accds.out {
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

/// Constructs the [`PreVotingData`] necessary for ballot verification with
/// election guard.
fn get_verification_context(
    election_parameters: ElectionParameters,
    election_manifest: ElectionManifest,
    guardian_public_keys: &[GuardianPublicKey],
) -> anyhow::Result<PreVotingData> {
    let joint_election_public_key =
        JointElectionPublicKey::compute(&election_parameters, guardian_public_keys)
            .context("Could not compute joint election public key")?;

    let hashes = Hashes::compute(&election_parameters, &election_manifest)
        .context("Could not compute hashes from election context")?;

    let hashes_ext = HashesExt::compute(
        &election_parameters,
        &hashes,
        &joint_election_public_key,
        guardian_public_keys,
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

async fn handle_vote_collection(
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

    let guardian_public_keys = config
        .guardian_keys
        .iter()
        .map(|bytes| rmp_serde::from_slice(bytes))
        .collect::<Result<Vec<GuardianPublicKey>, _>>()
        .context("Could not deserialize guardian public key")?;

    let verification_context: PreVotingData = get_verification_context(
        election_parameters,
        election_manifest.clone(),
        &guardian_public_keys,
    )?;

    let (_, first_block, last_block) = range_setup(endpoint.clone(), start, end).await?;

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
            eprintln!("Done indexing");
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
            let Ok(ballot) = rmp_serde::from_slice::<eg::ballot::BallotEncrypted>(param.as_ref()) else {
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

    let mut tally = eg::ballot::BallotTallyBuilder::new(&election_manifest);
    for row in final_weights.deserialize() {
        let FinalWeightRow {
            account,
            amount,
            delegators,
        } = row?;
        if let Some((ballot, hash)) = ballots.remove(&AccountAddressEq::from(account)) {
            // TODO: Scale the ballot for this account.
            tally.update(ballot);
        } // else the account did not vote, so nothing to do.
    }
    let tally = tally.finalize();

    let serialized_tally = rmp_serde::to_vec(&tally)?;
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
        let nonce = contract_client
            .client
            .get_next_account_sequence_number(&wallet.address)
            .await?;
        let dry_run = contract_client
            .invoke_raw::<ViewError>(
                "postEncryptedTally",
                Amount::zero(),
                Some(wallet.address.into()),
                param,
                BlockIdentifier::LastFinal,
            )
            .await
            .context("Failed to dry run")?;
        let energy = match dry_run {
            concordium_rust_sdk::types::smart_contracts::InvokeContractResult::Success {
                used_energy,
                ..
            } => (used_energy.energy + 100).into(),
            concordium_rust_sdk::types::smart_contracts::InvokeContractResult::Failure {
                reason,
                ..
            } => {
                anyhow::bail!("Failed to dry run contract update due to {reason:#?}");
            }
        };

        let metadata = ContractTransactionMetadata {
            sender_address: wallet.address,
            nonce:          nonce.nonce,
            expiry:         TransactionTime::hours_after(1),
            energy:         GivenEnergy::Add(energy),
            amount:         Amount::zero(),
        };

        let tx_hash = contract_client
            .update::<_, anyhow::Error>(&wallet, &metadata, "postEncryptedTally", &serialized_tally)
            .await
            .context("Failed to send transaction to post the tally.")?;
        eprintln!("Transaction {tx_hash} sent. Await finalization.");
        let (block_hash, outcome) = contract_client
            .client
            .wait_until_finalized(&tx_hash)
            .await?;
        if let Some(reason) = outcome.is_rejected_account_transaction() {
            eprintln!("Transaction failed with {reason:#?}");
        } else {
            eprintln!("Transaction successful and finalized in block {block_hash}.");
        }
    } else {
        eprintln!(
            "The tally is currently not registered in the contract, and no keys were provided."
        );
    }
    Ok(())
}

async fn handle_gather_average_balance(
    endpoint: sdk::Endpoint,
    accds: RangeWithOutput,
) -> anyhow::Result<()> {
    let (mut client, first_block, last_block) =
        range_setup(endpoint.clone(), accds.start, accds.end).await?;
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
