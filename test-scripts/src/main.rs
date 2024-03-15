use anyhow::Context;
use clap::Parser as _;
use concordium_governance_committee_election as contract;
use concordium_rust_sdk::{
    base::transactions::{self, send},
    common::types::TransactionTime,
    contract_client::{self, ContractTransactionMetadata, ViewError},
    smart_contracts::common::Amount,
    types::{
        smart_contracts::{OwnedContractName, OwnedParameter, WasmModule},
        transactions::InitContractPayload,
        Energy, WalletAccount,
    },
    v2::{self as sdk, BlockIdentifier},
};
use contract::{ChecksumUrl, GuardiansState, RegisterGuardianPublicKeyParameter};
use eg::{
    ballot::BallotEncrypted,
    ballot_style::{BallotStyle, BallotStyleIndex},
    contest_selection::ContestSelection,
    device::Device,
    election_manifest::ContestIndex,
    election_record::PreVotingData,
    guardian::GuardianIndex,
    guardian_secret_key::GuardianSecretKey,
    guardian_share::{GuardianEncryptedShare, GuardianSecretKeyShare},
    varying_parameters::VaryingParameters,
    verifiable_decryption::{
        CombinedDecryptionShare, DecryptionProof, DecryptionShare, DecryptionShareResult,
    },
};
use election_common::{decode, encode, EncryptedTally, GuardianDecryption, WeightRow};
use futures::{stream::FuturesUnordered, TryStreamExt};
use rand::Rng;
use sha2::Digest;
use std::collections::BTreeMap;

/// A writer adapter that computes the hash of the written value on the fly.
struct HashedWriter<W> {
    inner:  W,
    hasher: sha2::Sha256,
}

impl<W: std::io::Write> HashedWriter<W> {
    pub fn new(inner: W) -> Self {
        Self {
            inner,
            hasher: sha2::Sha256::new(),
        }
    }

    /// Flush the writer and return the hash.
    pub fn finish(mut self) -> std::io::Result<[u8; 32]> {
        self.inner.flush()?;
        Ok(self.hasher.finalize().into())
    }
}

impl<W: std::io::Write> std::io::Write for HashedWriter<W> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.hasher.update(buf);
        self.inner.write(buf)
    }

    fn flush(&mut self) -> std::io::Result<()> { self.inner.flush() }
}

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
    node_endpoint:     concordium_rust_sdk::v2::Endpoint,
    /// List of eligible voters. If this is not set then the eligible voters are
    /// all accounts with equal weight, and an `eligible-voters.csv` file
    /// is emitted to the output directory.
    #[arg(
        long = "eligible-voters",
        help = "A path to the list of eligible voters. This file is hashed and the hash put into \
                the contract."
    )]
    eligible_voters:   Option<std::path::PathBuf>,
    #[arg(
        long = "module",
        help = "Source module from which to initialize the contract instances."
    )]
    module:            std::path::PathBuf,
    #[arg(long = "keys", help = "Directory with account keys.")]
    keys:              std::path::PathBuf,
    #[arg(
        long = "num-options",
        help = "Number of options to vote for.",
        default_value = "5"
    )]
    num_options:       usize,
    #[arg(
        long = "election-duration",
        help = "Duration of the election in minutes. Should be at least 1.",
        default_value = "2"
    )]
    election_duration: i64,
    #[arg(
        long = "base-url",
        help = "Base url where the election data is accessible. This is recorded in the contract.",
        default_value = "http://localhost:7000/"
    )]
    base_url:          url::Url,
    #[arg(long = "out", help = "Output directory for all the artifacts.")]
    out:               std::path::PathBuf,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    let endpoint = if args
        .node_endpoint
        .uri()
        .scheme()
        .map_or(false, |x| x == &sdk::Scheme::HTTPS)
    {
        args.node_endpoint
            .tls_config(tonic::transport::channel::ClientTlsConfig::new())
            .context("Unable to construct TLS configuration for the Concordium API.")?
    } else {
        args.node_endpoint
    }
    .connect_timeout(std::time::Duration::from_secs(5))
    .timeout(std::time::Duration::from_secs(10));

    let (admin, guardians) = {
        let dir = std::fs::read_dir(&args.keys)?;
        let mut accounts = dir.map(|x| x.map(|f| WalletAccount::from_json_file(f.path())));
        let admin = accounts
            .next()
            .context("Expect at least one account")?
            .context("Unable to read account keys")??;
        eprintln!("Using account {} as the admin account.", admin.address);
        let guardian_keys: Vec<WalletAccount> = accounts
            .map(|a| {
                let wallet = a??;
                eprintln!("Using {} as a guardian.", wallet.address);
                Ok(wallet)
            })
            .collect::<anyhow::Result<Vec<_>>>()?;
        anyhow::ensure!(
            !guardian_keys.is_empty(),
            "Need at least one guardian account."
        );
        (admin, guardian_keys)
    };

    let (params_out, ccd_out) = {
        let params_out = args.out.join("static").join("electionguard");
        let ccd_out = args.out.join("static").join("concordium");
        std::fs::create_dir_all(&params_out)?;
        std::fs::create_dir_all(&ccd_out)?;
        (params_out, ccd_out)
    };

    let url = &args.base_url;
    let make_url = move |path: &str| -> String {
        let mut url = url.clone();
        url.set_path(path);
        url.to_string()
    };

    let candidates: Vec<ChecksumUrl> = {
        std::fs::create_dir_all(args.out.join("candidates"))?;
        (0..args.num_options)
            .map(|c| {
                let path = args.out.join(format!("candidates/{c}.json"));
                let candidate_details = serde_json::json!({
                    "name": format!("Candidate {c}"),
                    "imageUrl": "https://picsum.photos/300/300",
                    "descriptionUrl": "https://concordium.com"
                });
                let candidate_details_bytes = serde_json::to_vec_pretty(&candidate_details)?;
                std::fs::write(path, &candidate_details_bytes)?;
                let web_path = format!("candidates/{c}.json",);
                Ok::<_, anyhow::Error>(ChecksumUrl {
                    url:  make_url(&web_path),
                    hash: contract::HashSha2256(
                        sha2::Sha256::digest(candidate_details_bytes).into(),
                    ),
                })
            })
            .collect::<Result<_, _>>()?
    };
    let num_options = candidates.len();

    let (manifest, manifest_digest) = {
        let options = (0..num_options)
            .map(|o| eg::election_manifest::ContestOption {
                label: format!("Candidate {o}"),
            })
            .collect::<Vec<_>>()
            .try_into()?;
        let contest = eg::election_manifest::Contest {
            label: "New governance committee member".into(),
            selection_limit: num_options,
            options,
        };
        let manifest = eg::election_manifest::ElectionManifest {
            label:         "Test election manifest".into(),
            contests:      [contest].try_into()?,
            ballot_styles: [BallotStyle {
                label:    "Governance committee vote".into(),
                contests: [ContestIndex::from_one_based_index_const(1).unwrap()].into(),
            }]
            .try_into()?,
        };
        let manifest_json = serde_json::to_vec_pretty(&manifest)?;
        let digest: [u8; 32] = sha2::Sha256::digest(&manifest_json).into();
        std::fs::write(params_out.join("election-manifest.json"), manifest_json)?;
        (manifest, digest)
    };

    let (parameters, parameters_digest) = {
        let n = GuardianIndex::from_one_based_index(guardians.len().try_into()?)
            .context("Need at least one guardian.")?;

        // Hardcoded to at most 2 guardians being enough.
        let k = std::cmp::min(guardians.len().try_into()?, 2);
        let k = GuardianIndex::from_one_based_index_const(k as u32)
            .expect("Cannot fail, k is at least 1 at this point.");

        let parameters = eg::election_parameters::ElectionParameters {
            fixed_parameters:   eg::standard_parameters::STANDARD_PARAMETERS.clone(),
            varying_parameters: VaryingParameters {
                n,
                k,
                date: chrono::Utc::now(),
                info: format!("Test election with {} guardians.", guardians.len()),
                ballot_chaining: eg::varying_parameters::BallotChaining::Prohibited,
            },
        };
        let parameters_json = serde_json::to_vec_pretty(&parameters)?;
        let digest: [u8; 32] = sha2::Sha256::digest(&parameters_json).into();
        std::fs::write(params_out.join("election-parameters.json"), parameters_json)?;
        (parameters, digest)
    };

    let mut client = sdk::Client::new(endpoint).await?;

    // deploy module
    let mod_ref = {
        let module = WasmModule::from_file(&args.module)?;
        let mod_ref = module.get_module_ref();
        if client
            .get_module_source(&mod_ref, BlockIdentifier::LastFinal)
            .await
            .is_ok()
        {
            eprintln!("Source module with reference {mod_ref} already exists.");
        } else {
            let nonce = client
                .get_next_account_sequence_number(&admin.address)
                .await?;
            let tx = transactions::send::deploy_module(
                &admin,
                admin.address,
                nonce.nonce,
                TransactionTime::hours_after(1),
                module,
            );
            let hash = client.send_account_transaction(tx).await?;
            eprintln!("Send deployment transaction with hash {hash}.");
            let (block_hash, result) = client.wait_until_finalized(&hash).await?;
            if let Some(err) = result.is_rejected_account_transaction() {
                anyhow::bail!("Failed to deploy module: {err:#?}");
            }
            eprintln!("Deployed module with reference {mod_ref} in block {block_hash}");
        }
        mod_ref
    };

    let delegation_string = "Delegation string";

    // initialize new instance
    let (start_timestamp, end_timestamp, mut contract_client) = {
        let start_timestamp = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::minutes(2))
            .context("Time overflow.")?;
        let election_start = start_timestamp.try_into()?;
        let end_timestamp = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::minutes(args.election_duration + 2))
            .context("Time overflow")?;
        let decryption_deadline = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::minutes(args.election_duration + 10))
            .context("Time overflow")?;

        let election_end = end_timestamp.try_into()?;
        let eligible_voters_hash = if let Some(voters_file) = args.eligible_voters {
            let mut file = std::fs::File::open(voters_file)?;
            let mut hasher = sha2::Sha256::new();
            std::io::copy(&mut file, &mut hasher)?;
            contract::HashSha2256(hasher.finalize().into())
        } else {
            // give each account weight 3 CCD
            let mut accs = client
                .get_account_list(BlockIdentifier::LastFinal)
                .await?
                .response;
            let voters_path = ccd_out.join("eligible-voters.csv");
            let mut writer =
                csv::Writer::from_writer(HashedWriter::new(std::fs::File::create(&voters_path)?));

            while let Some(account) = accs.try_next().await? {
                writer.serialize(WeightRow {
                    account,
                    amount: Amount::from_ccd(3),
                })?;
            }

            let hash = writer.into_inner()?.finish()?;
            contract::HashSha2256(hash)
        };
        let eligible_voters = contract::ChecksumUrl {
            url:  make_url("static/concordium/eligible-voters.csv"),
            hash: eligible_voters_hash,
        };
        let init_param = contract::InitParameter {
            admin_account: admin.address,
            candidates,
            guardians: guardians.iter().map(|g| g.address).collect(),
            eligible_voters,
            election_manifest: contract::ChecksumUrl {
                url:  make_url("static/electionguard/election-manifest.json"),
                hash: contract::HashSha2256(manifest_digest),
            },
            election_parameters: contract::ChecksumUrl {
                url:  make_url("static/electionguard/election-parameters.json"),
                hash: contract::HashSha2256(parameters_digest),
            },
            election_description: "Test election".into(),
            election_start,
            election_end,
            decryption_deadline: decryption_deadline.try_into()?,
            delegation_string: delegation_string.into(),
        };
        let nonce = client
            .get_next_account_sequence_number(&admin.address)
            .await?;
        let expiry = TransactionTime::hours_after(1);
        let payload = InitContractPayload {
            amount: Amount::zero(),
            mod_ref,
            init_name: OwnedContractName::new_unchecked("init_election".into()),
            param: OwnedParameter::from_serial(&init_param)?,
        };
        let energy = Energy::from(10000);
        let tx = transactions::send::init_contract(
            &admin,
            admin.address,
            nonce.nonce,
            expiry,
            payload,
            energy,
        );
        let hash = client.send_account_transaction(tx).await?;
        eprintln!("Send initialization transaction with hash {hash}.");
        let (block_hash, result) = client.wait_until_finalized(&hash).await?;
        if let Some(error) = result.is_rejected_account_transaction() {
            anyhow::bail!("Failed to initialize contract: {error:#?}.");
        }
        let info = result.contract_init().context("Expect an init result")?;
        eprintln!(
            "Successfully initialized contract in block {block_hash}, with address {}.",
            info.address
        );
        let cc = contract_client::ContractClient::<ElectionContractMarker>::create(
            client.clone(),
            info.address,
        )
        .await?;
        (start_timestamp, end_timestamp, cc)
    };

    let mut rng = util::csprng::Csprng::new(b"Test keys seed.");

    let (guardian_secret_keys, guardian_public_keys) = {
        let mut guardian_keys = Vec::with_capacity(guardians.len());
        let mut guardian_public_keys = Vec::with_capacity(guardians.len());
        // create new guardians
        let futs = FuturesUnordered::new();
        for (g, g_acc) in (1..=guardians.len()).zip(&guardians) {
            let index = GuardianIndex::from_one_based_index(g as u32)?;
            let key = GuardianSecretKey::generate(
                &mut rng,
                &parameters,
                index,
                Some(format!("Test guardian {g}.")),
            );
            let public_key = key.make_public_key();
            std::fs::write(
                ccd_out.join(format!("guardian-{g}.json")),
                serde_json::to_string_pretty(&key)?,
            )
            .context("Unable to write guardian keys.")?;

            let param = encode(&public_key)?;
            let mut contract_client = contract_client.clone();
            let fut = async move {
                let tx_dry_run = contract_client
                    .dry_run_update::<RegisterGuardianPublicKeyParameter, ViewError>(
                        "registerGuardianPublicKey",
                        Amount::zero(),
                        g_acc.address,
                        &param,
                    )
                    .await?;

                let tx_hash = tx_dry_run.send(g_acc).await?;

                eprintln!("Submitted guardian {g} key application with transaction hash {tx_hash}");

                if let Err(err) = tx_hash.wait_for_finalization().await {
                    anyhow::bail!("Registering public key failed: {err:#?}");
                }
                Ok(g)
            };
            futs.push(fut);

            guardian_public_keys.push(public_key);
            guardian_keys.push(key);
        }

        futs.try_for_each(|g| async move {
            eprintln!("Public key for guardian {g} is registered");
            Ok(())
        })
        .await?;

        let futs = FuturesUnordered::new();
        for ((g, g_acc), dealer_private_key) in (1..).zip(&guardians).zip(&guardian_keys) {
            let mut shares = Vec::new();
            for dealer_public_key in &guardian_public_keys {
                let share = GuardianEncryptedShare::encrypt(
                    &mut rng,
                    &parameters,
                    dealer_private_key,
                    dealer_public_key,
                );
                shares.push(share.ciphertext);
            }

            let param = encode(&shares)?;

            let mut contract_client = contract_client.clone();
            let fut = async move {
                let dry_run = contract_client
                    .dry_run_update::<Vec<u8>, ViewError>(
                        "registerGuardianEncryptedShare",
                        Amount::zero(),
                        g_acc.address,
                        &param,
                    )
                    .await?;

                let tx_hash = dry_run.send(g_acc).await?;

                eprintln!("Submitted guardian's key shares with transaction hash {tx_hash}");

                if let Err(err) = tx_hash.wait_for_finalization().await {
                    anyhow::bail!("Registering key shares failed: {err:#?}");
                }
                Ok(g)
            };
            futs.push(fut);
        }

        futs.try_for_each(|g| async move {
            eprintln!("Key shares for guardian {g} registered");
            Ok(())
        })
        .await?;

        (guardian_keys, guardian_public_keys)
    };

    // Now all the key shares are registered. Check all of them.
    let guardian_secret_shares = {
        let mut guardian_secret_shares = Vec::new();
        let mut guardians_state = contract_client
            .view::<_, GuardiansState, ViewError>(
                "viewGuardiansState",
                &(),
                BlockIdentifier::LastFinal,
            )
            .await?;
        guardians_state.sort_by_key(|(_, g)| g.index);
        for (g_i, secret_key) in (1..).zip(&guardian_secret_keys) {
            let mut guardian_key_shares = Vec::new();
            for (_, guardian_state) in &guardians_state {
                let share = guardian_state
                    .encrypted_share
                    .as_ref()
                    .context("Guardian share not registered.")?;
                let mut shares = decode::<Vec<GuardianEncryptedShare>>(share)
                    .context("Unable to parse key shares.")?;
                let Ok(i) = shares.binary_search_by_key(
                    &GuardianIndex::from_one_based_index(g_i as u32)?,
                    |x: &GuardianEncryptedShare| x.recipient,
                ) else {
                    anyhow::bail!("Could not find guardian's encrypted share.");
                };
                let share = shares.swap_remove(i);
                drop(shares);
                let dealer_public_key = &guardian_public_keys[share.dealer.get_zero_based_usize()];
                if let Err(e) =
                    share.decrypt_and_validate(&parameters, dealer_public_key, secret_key)
                {
                    anyhow::bail!(
                        "Failed to decrypt and validate share for guardian {} using dealer {}. \
                         Reason: {e:#}",
                        share.recipient,
                        share.dealer
                    )
                }
                guardian_key_shares.push(share);
            }
            guardian_secret_shares.push(GuardianSecretKeyShare::compute(
                &parameters,
                &guardian_public_keys,
                &guardian_key_shares,
                secret_key,
            )?);
        }
        guardian_secret_shares
    };

    // Post that each guardian is happy.
    {
        eprintln!("Publishing that each guardian is happy with all the other guardian's shares.");
        let futs = FuturesUnordered::new();
        for guardian in &guardians {
            let mut contract_client = contract_client.clone();
            let fut = async move {
                let tx_dry_run = contract_client
                    .dry_run_update::<contract::GuardianStatus, ViewError>(
                        "registerGuardianStatus",
                        Amount::zero(),
                        guardian.address,
                        &contract::GuardianStatus::VerificationSuccessful,
                    )
                    .await?;

                let tx_hash = tx_dry_run.send(guardian).await?;

                eprintln!(
                    "Submitted approval for guardian {} application with transaction hash \
                     {tx_hash}",
                    guardian.address
                );

                if let Err(err) = tx_hash.wait_for_finalization().await {
                    anyhow::bail!("Registering verification status failed: {err:#?}");
                }
                eprintln!(
                        "Registered verification successful for guardian {}",
                        guardian.address
                    );
                Ok::<(), anyhow::Error>(())
            };
            futs.push(fut);
        }
        futs.try_collect::<()>().await?;
    }

    {
        let to_wait = start_timestamp.signed_duration_since(chrono::Utc::now());
        let num_millis = to_wait.num_milliseconds();
        if num_millis > 0 {
            eprintln!(
                "Waiting for {} seconds for the election to start.",
                num_millis / 1000
            );
            tokio::time::sleep(std::time::Duration::from_millis(num_millis as u64)).await;
        }
    }

    // Now do some voting.

    let context =
        PreVotingData::compute(manifest.clone(), parameters.clone(), &guardian_public_keys)
            .context("Unable to compute joint public key.")?;
    let contest = ContestIndex::from_one_based_index(1)?;
    {
        let device = Device::new(&uuid::Uuid::new_v4().to_string(), context);
        let mut delegation_hashes = Vec::with_capacity(guardians.len() + 1);
        let mut hashes = Vec::with_capacity(guardians.len() + 1);

        // Delegate voting power from first account to second account
        let delegator = guardians.first().context("Failed to get first wallet")?;
        for delegatee in [guardians.get(1), guardians.get(2)].into_iter().flatten() {
            let nonce = client
                .get_next_account_sequence_number(&delegator.address)
                .await?;

            let memo = serde_cbor::to_vec(&delegation_string)
                .context("Failed to serialize string")?
                .try_into()?;
            let account_transaction = send::transfer_with_memo(
                &delegator,
                delegator.address,
                nonce.nonce,
                TransactionTime::hours_after(1),
                delegatee.address,
                Amount::from_micro_ccd(1),
                memo,
            );

            let tx_hash = client.send_account_transaction(account_transaction).await?;
            eprintln!(
                "Submitted delegation for {} to {} with transaction hash {tx_hash}",
                delegator.address, delegatee.address,
            );
            delegation_hashes.push((delegator.address, delegatee.address, tx_hash));
        }

        for voter in guardians.iter().chain(std::iter::once(&admin)) {
            let primary_nonce: [u8; 32] = rand::thread_rng().gen();
            let selections = ContestSelection::new(
                (0..num_options)
                    .map(|_| if rand::thread_rng().gen() { 1u8 } else { 0u8 })
                    .collect(),
            )
            .context("Unable to vote.")?;
            eprintln!("Voter {} voting {:?}", voter.address, selections.get_vote());
            let ballot = BallotEncrypted::new_from_selections(
                BallotStyleIndex::from_one_based_index_unchecked(1),
                &device,
                &mut rng,
                &primary_nonce,
                &[(contest, selections)].into(),
            )
            .context("Unable to construct ballot.")?;
            let ballot_data = encode(&ballot)?;
            eprintln!("Ballot serialized size {}B", ballot_data.len());
            let nonce = client
                .get_next_account_sequence_number(&voter.address)
                .await?;

            let metadata = ContractTransactionMetadata {
                sender_address: voter.address,
                nonce:          nonce.nonce,
                expiry:         TransactionTime::hours_after(1),
                energy:         transactions::send::GivenEnergy::Add(10000.into()),
                amount:         Amount::zero(),
            };

            let tx_hash = contract_client
                .update::<Vec<u8>, anyhow::Error>(voter, &metadata, "registerVotes", &ballot_data)
                .await?;
            eprintln!(
                "Submitted vote for {} with transaction hash {tx_hash}",
                voter.address
            );
            hashes.push((voter.address, tx_hash));
        }

        for (delegator, delegatee, tx_hash) in delegation_hashes {
            if let Some(err) = client
                .wait_until_finalized(&tx_hash)
                .await?
                .1
                .is_rejected_account_transaction()
            {
                anyhow::bail!("Registering delegation failed: {err:#?}");
            }
            eprintln!("Delegation for {} to {} registered", delegator, delegatee);
        }

        for (voter, tx_hash) in hashes {
            if let Some(err) = client
                .wait_until_finalized(&tx_hash)
                .await?
                .1
                .is_rejected_account_transaction()
            {
                anyhow::bail!("Registering vote failed: {err:#?}");
            }
            eprintln!("Vote for {} registered", voter);
        }
    }

    {
        let to_wait = chrono::Utc::now().signed_duration_since(end_timestamp);
        if to_wait.num_milliseconds() > 0 {
            eprintln!(
                "Waiting until election ends, for {} seconds.",
                to_wait.num_seconds()
            );
            tokio::time::sleep(to_wait.to_std()?).await;
        }
    }

    // Wait until the encrypted tally is registered.
    let (guardian_secret_states, ciphertexts) = {
        let spinner = indicatif::ProgressBar::new_spinner();
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(1000));
        let serialized_tally = loop {
            interval.tick().await;
            let r = contract_client
                .view::<(), Option<Vec<u8>>, ViewError>(
                    "viewEncryptedTally",
                    &(),
                    BlockIdentifier::LastFinal,
                )
                .await?;
            if let Some(serialized_tally) = r {
                break serialized_tally;
            } else {
                spinner.set_message("Waiting until the encrypted tally is registered.");
                spinner.tick();
            }
        };
        eprintln!("Retrieved encrypted tally.");
        let encrypted_tally =
            decode::<EncryptedTally>(&serialized_tally).context("Unable to read tally.")?;

        // State maintained by guardians for the proof of decryption.
        let mut secret_states = Vec::new();

        for (share, guardian_wallet) in guardian_secret_shares.iter().zip(&guardians) {
            let mut decryptions = BTreeMap::new();
            let mut secret_states_map = BTreeMap::new();
            for (&index, ciphertexts) in &encrypted_tally {
                let secret_states_for_i = secret_states_map.entry(index).or_insert(Vec::new());
                let decryption_shares = decryptions
                    .entry(index)
                    .or_insert_with(|| Vec::with_capacity(ciphertexts.len()));
                for ciphertext in ciphertexts {
                    let ds = DecryptionShare::from(&parameters.fixed_parameters, share, ciphertext);
                    let (proof_commit, secret_state) = DecryptionProof::generate_commit_share(
                        &mut rng,
                        &parameters.fixed_parameters,
                        ciphertext,
                        &ds.i,
                    );
                    decryption_shares.push(DecryptionShareResult {
                        share: ds,
                        proof_commit,
                    });
                    secret_states_for_i.push(secret_state);
                }
            }
            secret_states.push(secret_states_map);

            let decryptions = encode(&decryptions)?;

            eprintln!("Serialized decryption share is {}B.", decryptions.len());

            let dry_run_result = contract_client
                .dry_run_update::<Vec<u8>, ViewError>(
                    "postDecryptionShare",
                    Amount::zero(),
                    guardian_wallet.address,
                    &decryptions,
                )
                .await?;

            let tx_hash = dry_run_result.send(guardian_wallet).await?;

            eprintln!("Submitted decryption share with transaction {tx_hash}");

            if let Err(err) = tx_hash.wait_for_finalization().await {
                anyhow::bail!("Registering decryption share failed: {err:#?}");
            }

            eprintln!(
                "Registered decryption shares for guardian {}",
                guardian_wallet.address
            );
        }
        (secret_states, encrypted_tally)
    };

    // Now for each guardian gather decrypted shares.
    {
        let context =
            PreVotingData::compute(manifest.clone(), parameters.clone(), &guardian_public_keys)
                .context("Unable to compute joint public key.")?;
        let mut guardians_state = contract_client
            .view::<_, GuardiansState, ViewError>(
                "viewGuardiansState",
                &(),
                BlockIdentifier::LastFinal,
            )
            .await?;
        guardians_state.sort_by_key(|(_, g)| g.index);
        for ((secret_key, secret_states), guardian_wallet) in guardian_secret_shares
            .iter()
            .zip(guardian_secret_states)
            .zip(&guardians)
        {
            let mut response_shares = BTreeMap::new();
            for (index, ciphertexts_state) in &secret_states {
                // gather all decryption shares for a specific ciphertext.
                let mut response_shares_i = Vec::new();
                for (i, ciphertext_state) in ciphertexts_state.iter().enumerate() {
                    let mut commit_shares = Vec::new();
                    let mut decryption_shares = Vec::new();
                    for gs in &guardians_state {
                        let Some(share_result) = gs.1.decryption_share.as_ref() else {
                            anyhow::bail!("Share not present even though it was registered.");
                        };
                        let share_result = decode::<GuardianDecryption>(share_result)
                            .context("Unable to parse decryption share result.")?;
                        let result = &share_result
                            .get(index)
                            .context("Contest index not present")?[i];
                        commit_shares.push(result.proof_commit.clone());
                        decryption_shares.push(result.share.clone());
                    }
                    let combined_decryption =
                        CombinedDecryptionShare::combine(&parameters, decryption_shares.iter())?;
                    let ciphertext = &ciphertexts.get(index).context("Unknown contest")?[i];
                    let proof = DecryptionProof::generate_response_share(
                        &parameters.fixed_parameters,
                        &context.hashes_ext,
                        &context.public_key,
                        ciphertext,
                        &combined_decryption,
                        &commit_shares,
                        ciphertext_state,
                        secret_key,
                    )?;
                    response_shares_i.push(proof);
                }
                response_shares.insert(*index, response_shares_i);
            }
            // Publish response shares

            let shares = encode(&response_shares)?;

            let dry_run_result = contract_client
                .dry_run_update::<_, ViewError>(
                    "postDecryptionProofResponseShare",
                    Amount::zero(),
                    guardian_wallet.address,
                    &shares,
                )
                .await?;

            let tx_hash = dry_run_result.send(guardian_wallet).await?;

            eprintln!("Submitted response share with transaction hash {tx_hash}");

            if let Err(err) = tx_hash.wait_for_finalization().await {
                anyhow::bail!("Registering response failed: {err:#?}");
            }

            eprintln!(
                "Registered response for guardian {}",
                guardian_wallet.address
            );
        }
    }

    Ok(())
}

enum ElectionContractMarker {}
