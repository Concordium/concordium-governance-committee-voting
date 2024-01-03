//! A tool for the election coordinator to gather data from the chain, and to
//! coordinate finalization of the election.

use anyhow::Context;
use clap::Parser;
use concordium_rust_sdk::{
    indexer,
    smart_contracts::common::{AccountAddress, Amount},
    types::{AbsoluteBlockHeight, AccountAddressEq, AccountIndex},
    v2::{self as sdk, BlockIdentifier},
};
use futures::TryStreamExt;
use indicatif::{ProgressBar, ProgressStyle};
use std::collections::BTreeSet;

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
    #[command(name = "average-ccd")]
    AccountCCDs(AccountCCDs),
}

#[derive(Debug, clap::Parser)]
struct AccountCCDs {
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
    #[arg(long = "out", help = "File to output average balances into.")]
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
        Command::AccountCCDs(accds) => {
            anyhow::ensure!(
                accds.start < accds.end,
                "Need a non-empty interval to index. The start time must be earlier than end time."
            );
            let mut client = sdk::Client::new(endpoint.clone()).await?;
            let first_block = client
                .find_first_finalized_block_no_earlier_than(.., accds.start)
                .await?;
            let initial_block_ident: BlockIdentifier = first_block.block_height.into();
            let initial_account_number = client
                .get_account_list(initial_block_ident)
                .await?
                .response
                .try_fold(0u64, |acc, _| async move { Ok(acc + 1) })
                .await?;
            let mut account_balances = vec![Vec::new(); initial_account_number as usize];
            let mut account_addresses = Vec::with_capacity(initial_account_number as usize);
            let bar = ProgressBar::new(initial_account_number).with_style(
                ProgressStyle::with_template("{spinner} {msg} {wide_bar} {pos}/{len}")?,
            );

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

            let last_block = {
                let last_block = client
                    .find_first_finalized_block_no_earlier_than(.., accds.end)
                    .await?;
                if last_block.block_slot_time > accds.end {
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
            let bar =
                ProgressBar::new(last_block.block_height.height - first_block.block_height.height)
                    .with_style(ProgressStyle::with_template(
                        "{spinner} {msg} {wide_bar} {pos}/{len}",
                    )?);

            let traverse_config =
                indexer::TraverseConfig::new_single(endpoint, first_block.block_height);
            let (sender, mut receiver) = tokio::sync::mpsc::channel(20);
            let cancel_handle =
                tokio::spawn(traverse_config.traverse(indexer::BlockEventsIndexer, sender));
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
                            account_balances
                                .push(vec![(first_block.block_slot_time, Amount::zero())]);
                            let idx_acc = client
                                .get_account_info(
                                    &AccountIndex::from(idx as u64).into(),
                                    block_ident,
                                )
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

            let mut out_handle: Box<dyn std::io::Write> = if let Some(file) = accds.out {
                Box::new(std::fs::File::create(file)?)
            } else {
                Box::new(std::io::stdout().lock())
            };
            anyhow::ensure!(
                account_addresses.len() == account_balances.len(),
                "Expecting addresses match account balances. This is a bug."
            );
            for (i, (balances, address)) in account_balances
                .into_iter()
                .zip(account_addresses)
                .enumerate()
            {
                let Some((&first, rest)) = balances.split_first() else {
                    anyhow::bail!("A bug, there should always be at least one reading.");
                };
                let mut last_time = first.0;
                let mut weighted_sum = u128::from(first.1.micro_ccd);
                let mut last_balance = weighted_sum;
                for &(dt, balance) in rest {
                    weighted_sum += (dt.signed_duration_since(last_time).num_milliseconds()
                        as u128)
                        * last_balance;
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
                writeln!(out_handle, "{i}, {address}, {amount}",)?;
            }
            out_handle.flush()?;
            drop(out_handle);
        }
    }
    Ok(())
}
