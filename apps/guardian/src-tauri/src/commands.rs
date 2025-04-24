use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
    str::FromStr,
};

use anyhow::{anyhow, Context};
use concordium_governance_committee_election::{self as contract, ElectionConfig};
use concordium_rust_sdk::{
    common::{
        encryption::{decrypt, encrypt, EncryptedData, Password},
        types::Amount,
    },
    id::types::AccountAddress,
    types::{ContractAddress, Energy, WalletAccount},
    v2::{self, BlockIdentifier},
    web3id::did::Network,
};
use eg::{
    election_parameters::ElectionParameters,
    election_record::PreVotingData,
    fixed_parameters::FixedParameters,
    guardian::GuardianIndex,
    guardian_public_key::GuardianPublicKey,
    guardian_secret_key::GuardianSecretKey,
    guardian_share::{GuardianEncryptedShare, GuardianSecretKeyShare, ShareEncryptionResult},
    joint_election_public_key::Ciphertext,
    verifiable_decryption::{
        CombinedDecryptionShare, DecryptionProof, DecryptionProofStateShare, DecryptionShare,
        DecryptionShareResult,
    },
};
use election_common::{
    decode, EncryptedTally, GuardianDecryption, GuardianDecryptionProof,
    GuardianDecryptionProofState,
};
use itertools::Itertools;
use rand::{thread_rng, Rng};
use serde::{de::DeserializeOwned, ser::SerializeStruct, Serialize};
use tauri::{AppHandle, Window};
use util::csprng::Csprng;

use crate::{
    config::{AppConfig, ElectionGuardConfig},
    shared::Error,
    state::{
        ActiveGuardian, ActiveGuardianState, AppConfigState, ContractData, ContractDataState,
        GuardianData,
    },
};

/// The file name of the encrypted wallet account.
const WALLET_ACCOUNT_FILE: &str = "guardian-data.json.aes";
/// The file name of the encrypted secret key for a guardian.
const SECRET_KEY_FILE: &str = "secret-key.json.aes";
/// The file name of the encrypted secret share for a guardian.
const SECRET_SHARE_FILE: &str = "secret-share.json.aes";
/// The file name of the encryption secret that a guardian can use
/// to prove they acted honestly in case of dispute in key sharing.
const KEY_SHARE_ENCRYPTION_SECRETS_FILE: &str = "key-share-secrets.json.aes";
/// The file name of the encrypted secret share for a guardian
const DECRYPTION_SECRET_STATES: &str = "secret-decryption_states.json.aes";

/// Get the data directory for guardians, creating it if it does not exist.
fn guardians_data_dir(
    app_handle: &AppHandle,
    contract: ContractAddress,
    network: Network,
) -> PathBuf {
    let guardian_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .unwrap() // Path is available as declared in `tauri.conf.json`
        .join(network.to_string())
        .join(format!("{}-{}", contract.index, contract.subindex));

    if !guardian_dir.exists() {
        let _ = std::fs::create_dir_all(&guardian_dir);
    }
    guardian_dir
}

/// Get the data directory for a guardian account
fn guardian_data_dir(
    app_handle: &AppHandle,
    account: AccountAddress,
    contract: ContractAddress,
    network: Network,
) -> PathBuf {
    guardians_data_dir(app_handle, contract, network).join(account.to_string())
}

/// Writes `data` encrypted with `password` to disk
fn write_encrypted_file<D: serde::Serialize>(
    password: &Password,
    data: &D,
    file_path: &Path,
) -> Result<(), Error> {
    let plaintext = serde_json::to_string(&data).context("Failed to serialize data")?;
    let mut rng = thread_rng();
    // Serialization will not fail at this point.
    let encrypted_data = serde_json::to_vec(&encrypt(password, &plaintext, &mut rng)).unwrap();
    std::fs::write(file_path, encrypted_data).context("Failed to write the file to disk")?;

    Ok(())
}

/// Deserialize contents of an encrypted file.
fn read_encrypted_file<D: serde::de::DeserializeOwned>(
    password: &Password,
    file_path: &PathBuf,
) -> Result<D, Error> {
    let encrypted_bytes = std::fs::read(file_path).context("Failed to read file from disk")?;
    let encrypted: EncryptedData = serde_json::from_slice(&encrypted_bytes)
        .map_err(|_| Error::Corrupted(file_path.clone()))?;

    let decrypted_bytes = decrypt(password, &encrypted).map_err(|_| Error::DecryptionFailed)?;
    let value = serde_json::from_slice(&decrypted_bytes).map_err(|_| Error::DecryptionFailed)?;
    Ok(value)
}

/// Handle a wallet import. Creates a directory for storing data associated with
/// the guardian account and returns the [`AccountAddress`] of the imported
/// wallet account.
///
/// This will create the data directory for the app if it does not already
/// exist.
///
/// ## Errors
/// Fails if the account has already been imported or if the guardian data could
/// not be written to disk (which should not happen).
#[tauri::command]
pub async fn import_wallet_account(
    wallet_account: WalletAccount,
    guardian_index: GuardianIndex,
    password: String,
    active_guardian: tauri::State<'_, ActiveGuardianState>,
    app_config: tauri::State<'_, AppConfigState>,
    app_handle: AppHandle,
) -> Result<AccountAddress, Error> {
    let account = wallet_account.address;
    let app_config = app_config.0.lock().await;
    let user_config = app_config.user_config();

    let guardian_dir = guardian_data_dir(
        &app_handle,
        account,
        user_config.contract()?,
        user_config.network,
    );
    if guardian_dir.exists() {
        return Err(Error::ExistingAccount);
    }
    std::fs::create_dir(&guardian_dir)?;

    let password = Password::from(password);
    let guardian_data = GuardianData::create(wallet_account, guardian_index);
    let account_address = guardian_data.account;
    write_encrypted_file(
        &password,
        &guardian_data,
        &guardian_dir.join(WALLET_ACCOUNT_FILE),
    )?;

    let mut active_guardian = active_guardian.0.lock().await;
    *active_guardian = Some(ActiveGuardian {
        guardian: guardian_data,
        password,
    });

    Ok(account_address)
}

/// Gets the accounts which have previously been imported into the application.
///
/// ## Errors
/// Fails if the appliction data directory could not be read, which should not
/// happen due to ensuring the existence during application setup.
#[tauri::command(async)]
pub fn get_accounts(handle: AppHandle) -> Result<Vec<AccountAddress>, Error> {
    let app_data_dir = handle.path_resolver().app_data_dir().unwrap();
    let entries = std::fs::read_dir(app_data_dir)?;

    let accounts: Vec<_> = entries
        .into_iter()
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            if path.is_file() {
                return None;
            }

            let folder_str = path.file_name()?.to_str()?;
            AccountAddress::from_str(folder_str).ok()
        })
        .collect();

    Ok(accounts)
}

/// Load a [`GuardianAccount`] from disk, decrypting the contents with
/// `password`
///
/// ## Errors
/// - [`Error::DecryptionError`]
#[tauri::command]
pub async fn load_account(
    account: AccountAddress,
    password: String,
    app_handle: AppHandle,
    active_guardian: tauri::State<'_, ActiveGuardianState>,
    app_config: tauri::State<'_, AppConfigState>,
) -> Result<(), Error> {
    let password = Password::from(password);
    let app_config = app_config.0.lock().await;
    let user_config = app_config.user_config();

    let account_path = guardian_data_dir(
        &app_handle,
        account,
        user_config.contract()?,
        user_config.network,
    )
    .join(WALLET_ACCOUNT_FILE);
    let guardian_data: GuardianData = read_encrypted_file(&password, &account_path)?;

    let mut active_guardian = active_guardian.0.lock().await;
    *active_guardian = Some(ActiveGuardian {
        guardian: guardian_data,
        password,
    });

    Ok(())
}

/// Generate a key pair for the selected guardian, storing the secret key on
/// disk and returning the public key. If the secret key already exists, it
/// returns the corresponding public key.
///
/// ## Errors
/// Any errors happening will be due to data corruption or internal errors.
pub fn generate_secret_key(
    active_guardian: &ActiveGuardian,
    election_parameters: &ElectionParameters,
) -> GuardianSecretKey {
    let account = active_guardian.guardian.account;
    let seed: [u8; 32] = thread_rng().gen();
    let mut csprng = Csprng::new(&seed);
    GuardianSecretKey::generate(
        &mut csprng,
        election_parameters,
        active_guardian.guardian.index,
        account.to_string().into(),
    )
}

/// Sends a message to the current [`Window`] and waits for a response. Uses the
/// supplied `id` as the event channel.
async fn send_message<M, R>(
    window: &Window,
    id: &str,
    message: M,
) -> Result<Option<R>, serde_json::Error>
where
    M: serde::Serialize + Clone,
    R: DeserializeOwned + Sync + Send + 'static, {
    // Construct the message channel and setup response listener
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window.once(id, move |e| {
        let response: Result<Option<R>, _> = e.payload().map(serde_json::from_str).transpose();
        let _ = sender.send(response); // Receiver will not be dropped
    });

    // Send the message
    let _ = window.emit(id, message);

    // Wait for the response
    receiver.await.unwrap() // Sender will not be dropped.
}

/// Submit a request for approval to the frontend, waiting for response. Only
/// accepts `true` as the response from the frontend; any other response will
/// result in an error.
async fn wait_for_approval<M: Serialize + Clone>(
    channel_id: &str,
    window: &Window,
    proposal: &M,
) -> Result<(), Error> {
    match send_message(window, channel_id, proposal).await {
        Ok(Some(true)) => Ok(()), // Transaction estimate approved
        Ok(Some(false)) => Err(Error::AbortInteraction), // Transaction estimate rejected
        Ok(None) => {
            Err(anyhow!("Expected a boolean value from the frontend, but received none").into())
        }
        Err(error) => Err(anyhow::Error::new(error)
            .context("Unexpected result received from the frontend, expected boolean value")
            .into()),
    }
}

async fn handle_abort(channel_id: &str, window: &Window) -> Error {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window.once(format!("{}::ABORT", &channel_id), move |_| {
        let _ = sender.send(()); // Receiver will not be dropped
    });

    receiver.await.unwrap(); // Sender will not be dropped.
    Error::AbortInteraction
}

/// This command executes the following steps:
///
/// - Generate a key pair, storing the secret key (encrypted) on disk
/// - Request transaction fee estimate approval from user
/// - Register guardian public key in the election contract
///
/// ## Errors
/// Expected errors include:
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
/// - [`Error::QueryFailed`]
#[tauri::command]
pub async fn register_guardian_key_flow(
    channel_id: String,
    active_guardian: tauri::State<'_, ActiveGuardianState>,
    app_config: tauri::State<'_, AppConfigState>,
    app_handle: AppHandle,
    window: Window,
) -> Result<(), Error> {
    let cancel = handle_abort(&channel_id, &window);
    let interaction = async {
        let active_guardian = active_guardian.0.lock().await;
        let active_guardian = active_guardian
            .as_ref()
            .context("Guardian account not available in app state")?;
        let mut app_config = app_config.0.lock().await;
        let public_key = {
            let user_config = app_config.user_config();

            let secret_key_path = guardian_data_dir(
                &app_handle,
                active_guardian.guardian.account,
                user_config.contract()?,
                user_config.network,
            )
            .join(SECRET_KEY_FILE);

            let secret_key = if secret_key_path.exists() {
                read_encrypted_file(&active_guardian.password, &secret_key_path)?
            } else {
                let election_parameters = app_config.election_guard().await?.parameters;
                let secret_key = generate_secret_key(active_guardian, &election_parameters);
                write_encrypted_file(&active_guardian.password, &secret_key, &secret_key_path)?;
                secret_key
            };
            secret_key.make_public_key()
        };

        let mut contract = app_config.contract().await?;
        let result = contract
            .register_guardian_public_key(&active_guardian.guardian.account, &public_key)
            .await?;

        // Wait for response from the user through the frontend
        wait_for_approval(&channel_id, &window, &result.current_energy()).await?;

        result
            .send(&active_guardian.guardian.keys)
            .await?
            .wait_for_finalization()
            .await?;

        Ok(())
    };

    tokio::select! {
        biased;
        error = cancel => Err(error),
        res = interaction => res
    }
}

/// Generate the encrypted shares for the active guardian together with secrets
/// that can be used to prove that we have not cheated in case of a dispute.
/// This is done by querying the public keys registered by all guardians, and
/// generating [`ShareEncryptionResult`] for each of them.
///
/// ## Errors
/// Expected errors include:
/// - [`Error::NodeConnection`]
/// - [`Error::PeerValidation`]
fn generate_encrypted_shares(
    election_parameters: &ElectionParameters,
    guardians_state: &contract::GuardiansState,
    secret_key: GuardianSecretKey,
) -> Result<Vec<ShareEncryptionResult>, Error> {
    let mut keys = Vec::with_capacity(guardians_state.len());
    let mut errors = Vec::with_capacity(guardians_state.len());
    for (account, guardian_state) in guardians_state {
        let bytes = guardian_state
            .public_key
            .as_ref()
            .with_context(|| format!("Public key not found for guardian with account {account}"))?;
        let Ok(public_key) = decode::<GuardianPublicKey>(bytes) else {
            errors.push(*account);
            continue;
        };

        keys.push(public_key);
    }

    if !errors.is_empty() {
        return Err(Error::PeerValidation(errors));
    }

    let mut rng = Csprng::new(&thread_rng().gen::<[u8; 32]>());
    let encrypted_shares: Vec<_> = keys
        .into_iter()
        .map(|recipient_public_key| {
            GuardianEncryptedShare::encrypt(
                &mut rng,
                election_parameters,
                &secret_key,
                &recipient_public_key,
            )
        })
        .collect();
    Ok(encrypted_shares)
}

/// Different possible branches of the flow for registering encrypted shares
#[derive(Debug, strum::IntoStaticStr, Clone)]
enum ValidatedProposal {
    /// All peer entities were successfully validated
    Success(Amount),
    /// Validation of some keys of guardian accounts failed
    Complaint(Amount),
}

impl ValidatedProposal {
    fn ccd_cost(&self) -> Amount {
        match self {
            Self::Success(amount) => *amount,
            Self::Complaint(amount) => *amount,
        }
    }
}

impl Serialize for ValidatedProposal {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
        let mut proposal = serializer.serialize_struct("ValidatedProposal", 2)?;
        proposal.serialize_field("type", <&str>::from(self))?;
        proposal.serialize_field("ccdCost", &self.ccd_cost())?;
        proposal.end()
    }
}

/// Runs the flow for computing and registering [`GuardianEncryptedShare`]s in
/// the election contract. This has two potential outcomes:
/// 1. All peer public keys are valid, the shares are computed and registered in
/// the election contract.
/// 2. One or more invalid keys have been detected, a complaint with the
/// associated guardian accounts is registered in    the election contract.
///
/// The following steps are run:
/// 1. Validate peer keys + generate encrypted shares if successful
/// 2. Request approval of transaction proposal (either registration of shares
/// or complaint) 3. Transaction submission + await finalization.
///
/// ## Errors
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
/// - [`Error::QueryFailed`]
#[tauri::command]
pub async fn register_guardian_shares_flow(
    channel_id: String,
    active_guardian: tauri::State<'_, ActiveGuardianState>,
    contract_data: tauri::State<'_, ContractDataState>,
    app_config: tauri::State<'_, AppConfigState>,
    app_handle: AppHandle,
    window: Window,
) -> Result<(), Error> {
    let cancel = handle_abort(&channel_id, &window);
    let interaction = async {
        let active_guardian = active_guardian.0.lock().await;
        let active_guardian = active_guardian
            .as_ref()
            .context("Guardian account not available in app state")?;
        let mut app_config = app_config.0.lock().await;
        let election_parameters = app_config.election_guard().await?.parameters;
        let contract_data = contract_data.0.lock().await;

        let user_config = app_config.user_config();
        let guardian_data_dir = guardian_data_dir(
            &app_handle,
            active_guardian.guardian.account,
            user_config.contract()?,
            user_config.network,
        );
        let secret_key_path = guardian_data_dir.join(SECRET_KEY_FILE);
        let secret_key = read_encrypted_file(&active_guardian.password, &secret_key_path)?;
        let encrypted_shares = match generate_encrypted_shares(
            &election_parameters,
            &contract_data.guardians,
            secret_key,
        ) {
            Ok(shares) => Ok(shares),
            Err(Error::PeerValidation(accounts)) => Err(accounts),
            Err(error) => return Err(error),
        };

        let mut contract = app_config.contract().await?;
        // Depending on whether any validation failures are detected, either:
        // 1. register the generated shares
        // 2. file a complaint with the guardian accounts with invalid key registrations
        let (proposal, contract_update) = match encrypted_shares {
            Ok(encrypted_shares_with_secrets) => {
                let (encrypted_shares, secrets) = encrypted_shares_with_secrets
                    .into_iter()
                    .map(|esws| (esws.ciphertext, esws.secret))
                    .unzip::<_, _, Vec<_>, Vec<_>>();

                let secrets_path = guardian_data_dir.join(KEY_SHARE_ENCRYPTION_SECRETS_FILE);

                write_encrypted_file(&active_guardian.password, &secrets, &secrets_path)?;

                let update = contract
                    .register_encrypted_shares(&active_guardian.guardian.account, &encrypted_shares)
                    .await?;

                let ccd_cost =
                    energy_to_ccd(update.current_energy(), &mut contract.0.client).await?;
                let proposal = ValidatedProposal::Success(ccd_cost);
                (proposal, update)
            }
            Err(accounts) => {
                let update = contract
                    .register_guardian_status(
                        &active_guardian.guardian.account,
                        &contract::GuardianStatus::KeyVerificationFailed(accounts), // Serialization will not fail
                    )
                    .await?;
                let ccd_cost =
                    energy_to_ccd(update.current_energy(), &mut contract.0.client).await?;
                let proposal = ValidatedProposal::Complaint(ccd_cost);
                (proposal, update)
            }
        };

        // Wait for response from the user through the frontend
        wait_for_approval(&channel_id, &window, &proposal).await?;

        contract_update
            .send(&active_guardian.guardian.keys)
            .await?
            .wait_for_finalization()
            .await?;

        Ok(())
    };

    tokio::select! {
        biased;
        error = cancel => Err(error),
        res = interaction => res
    }
}

async fn generate_secret_share(
    active_guardian: &ActiveGuardian,
    app_config: &mut AppConfig,
    contract_data: &ContractData,
    secret_key: GuardianSecretKey,
) -> Result<GuardianSecretKeyShare, Error> {
    let guardian_public_keys = contract_data.guardian_public_keys()?;
    let guardians = &contract_data.guardians;

    let parameters = app_config.election_guard().await?.parameters;
    let mut encrypted_shares = Vec::with_capacity(guardians.len());
    let mut errors = Vec::with_capacity(guardians.len());
    for (account, guardian_state) in guardians {
        let share = guardian_state
            .encrypted_share
            .as_ref()
            .context("Guardian share not registered.")?;

        let Ok(mut shares) = decode::<Vec<GuardianEncryptedShare>>(share) else {
            // If we cannot decode, the shares are invalid
            errors.push(*account);
            continue;
        };
        let Ok(i) = shares.binary_search_by_key(
            &active_guardian.guardian.index,
            |x: &GuardianEncryptedShare| x.recipient,
        ) else {
            // If we cannot find our share, the list of shares submitted is invalid
            errors.push(*account);
            continue;
        };

        let share = shares.swap_remove(i);
        drop(shares);
        let dealer_public_key = &guardian_public_keys[share.dealer.get_zero_based_usize()];
        if share
            .decrypt_and_validate(&parameters, dealer_public_key, &secret_key)
            .is_err()
        {
            // Finally, if the share cannot be validated, the individual share is invalid
            errors.push(*account);
            continue;
        }
        encrypted_shares.push(share)
    }

    if !errors.is_empty() {
        return Err(Error::PeerValidation(errors));
    }

    // Then we generate the secret share
    let secret_share = GuardianSecretKeyShare::compute(
        &parameters,
        &guardian_public_keys,
        &encrypted_shares,
        &secret_key,
    )
    .context("Failed to combine guardian shares")?;

    Ok(secret_share)
}
/// Runs the flow for computing and storing the [`GuardianSecretShare`] on disk.
/// This has two potential outcomes:
/// 1. All peer encrypted shares are valid, the secret share is computed and
/// stored on disk and finally an OK signal is sent to the contract
/// 2. One or more invalid keys have been detected, a complaint with the
/// associated guardian accounts is registered in the election contract
///
/// The following steps are run:
/// 1. Validate peer keys + generate encrypted shares if successful
/// 2. Request approval of transaction proposal (either registration of shares
/// or complaint)
/// 3. Transaction submission + await finalization.
///
/// ## Errors
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
/// - [`Error::QueryFailed`]
#[tauri::command]
pub async fn generate_secret_share_flow(
    channel_id: String,
    active_guardian: tauri::State<'_, ActiveGuardianState>,
    app_config: tauri::State<'_, AppConfigState>,
    contract_data: tauri::State<'_, ContractDataState>,
    app_handle: AppHandle,
    window: Window,
) -> Result<(), Error> {
    let cancel = handle_abort(&channel_id, &window);
    let interaction = async {
        let mut app_config = app_config.0.lock().await;
        let active_guardian_guard = active_guardian.0.lock().await;
        let active_guardian = active_guardian_guard
            .as_ref()
            .context("Active account not set")?;
        let contract_data = contract_data.0.lock().await;
        let user_config = app_config.user_config();
        let guardian_data_dir = guardian_data_dir(
            &app_handle,
            active_guardian.guardian.account,
            user_config.contract()?,
            user_config.network,
        );
        let secret_key_path = guardian_data_dir.join(SECRET_KEY_FILE);
        let secret_key: GuardianSecretKey =
            read_encrypted_file(&active_guardian.password, &secret_key_path)?;
        let secret_share_path = guardian_data_dir.join(SECRET_SHARE_FILE);
        let secret_share =
            generate_secret_share(active_guardian, &mut app_config, &contract_data, secret_key)
                .await;
        let secret_share = match secret_share {
            Ok(secret_share) => {
                // Write to disk regardless of whether it already exists to avoid data
                // corruption (at least up until this point)
                write_encrypted_file(&active_guardian.password, &secret_share, &secret_share_path)?;
                Ok(())
            }
            Err(Error::PeerValidation(accounts)) => Err(accounts),
            Err(error) => return Err(error),
        };

        // Depending on whether any validation failures are detected, either:
        // 1. register the generated shares
        // 2. file a complaint with the guardian accounts with invalid key registrations
        let guardian_status = match secret_share {
            Ok(_) => contract::GuardianStatus::VerificationSuccessful,
            Err(accounts) => contract::GuardianStatus::SharesVerificationFailed(accounts),
        };

        let mut contract = app_config.contract().await?;
        let contract_update = contract
            .register_guardian_status(&active_guardian.guardian.account, &guardian_status)
            .await?;
        let ccd_cost =
            energy_to_ccd(contract_update.current_energy(), &mut contract.0.client).await?;
        let proposal = match guardian_status {
            contract::GuardianStatus::VerificationSuccessful => {
                ValidatedProposal::Success(ccd_cost)
            }
            contract::GuardianStatus::SharesVerificationFailed(_) => {
                ValidatedProposal::Complaint(ccd_cost)
            }
            _ => unreachable!(), // As we know the guardian_status is one of the above
        };

        // Wait for response from the user through the frontend
        wait_for_approval(&channel_id, &window, &proposal).await?;

        contract_update
            .send(&active_guardian.guardian.keys)
            .await?
            .wait_for_finalization()
            .await?;

        Ok(())
    };

    tokio::select! {
        biased;
        error = cancel => Err(error),
        res = interaction => res
    }
}

/// Generate the decryption shares and the proof commitment shares corresponding
/// to each ciphertext in the encrypted tally
fn generate_decryption_shares(
    fixed_parameters: &FixedParameters,
    encrypted_tally: &EncryptedTally,
    secret_share: GuardianSecretKeyShare,
) -> (GuardianDecryption, GuardianDecryptionProofState) {
    let mut rng = Csprng::new(&thread_rng().gen::<[u8; 32]>());
    let mut decryption_shares = BTreeMap::new();
    let mut secret_states = BTreeMap::new();
    for (&contest_index, ciphertexts) in encrypted_tally {
        let (shares, states): (Vec<_>, Vec<_>) = ciphertexts
            .iter()
            .map(|ciphertext| {
                let share = DecryptionShare::from(fixed_parameters, &secret_share, ciphertext);
                let (proof_commit, secret_state) = DecryptionProof::generate_commit_share(
                    &mut rng,
                    fixed_parameters,
                    ciphertext,
                    &share.i,
                );
                let share = DecryptionShareResult {
                    share,
                    proof_commit,
                };
                (share, secret_state)
            })
            .unzip();
        decryption_shares.insert(contest_index, shares);
        secret_states.insert(contest_index, states);
    }

    (decryption_shares, secret_states)
}

/// This command executes the following steps:
///
/// - Generate a decryption share for each ciphertext found in the encrypted
///   tally.
/// - Request transaction fee estimate approval from user
/// - Register decryption shares in the contract
///
/// ## Errors
/// Expected errors include:
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
/// - [`Error::QueryFailed`]
#[tauri::command]
pub async fn register_decryption_shares_flow(
    channel_id: String,
    active_guardian: tauri::State<'_, ActiveGuardianState>,
    app_config: tauri::State<'_, AppConfigState>,
    contract_data: tauri::State<'_, ContractDataState>,
    app_handle: AppHandle,
    window: Window,
) -> Result<(), Error> {
    let cancel = handle_abort(&channel_id, &window);
    let interaction = async {
        let mut app_config = app_config.0.lock().await;
        let fixed_parameters = app_config
            .election_guard()
            .await?
            .parameters
            .fixed_parameters;

        let contract_data = contract_data.0.lock().await;
        let encrypted_tally = contract_data
            .encrypted_tally
            .as_ref()
            .context("Expected encrypted tally to be available in app state")?;

        let active_guardian = active_guardian.0.lock().await;
        let active_guardian = active_guardian
            .as_ref()
            .context("Expected guardian account to be available in app state")?;
        let user_config = app_config.user_config();
        let guardian_data_dir = guardian_data_dir(
            &app_handle,
            active_guardian.guardian.account,
            user_config.contract()?,
            user_config.network,
        );

        let secret_share = read_encrypted_file(
            &active_guardian.password,
            &guardian_data_dir.join(SECRET_SHARE_FILE),
        )?;

        let decryption_shares = {
            let (decryption_shares, secret_states) =
                generate_decryption_shares(&fixed_parameters, encrypted_tally, secret_share);
            write_encrypted_file(
                &active_guardian.password,
                &secret_states,
                &guardian_data_dir.join(DECRYPTION_SECRET_STATES),
            )?;
            decryption_shares
        };

        let mut contract = app_config.contract().await?;
        let contract_update = contract
            .post_decryption(&active_guardian.guardian.account, &decryption_shares)
            .await?;
        let ccd_cost =
            energy_to_ccd(contract_update.current_energy(), &mut contract.0.client).await?;

        // Wait for response from the user through the frontend
        wait_for_approval(&channel_id, &window, &ccd_cost).await?;

        contract_update
            .send(&active_guardian.guardian.keys)
            .await?
            .wait_for_finalization()
            .await?;

        Ok(())
    };

    tokio::select! {
        biased;
        error = cancel => Err(error),
        res = interaction => res
    }
}

/// Generate the decryption proofs for each ciphertext decryption in the
/// encrypted tally
async fn generate_decryption_proofs(
    app_config: &mut AppConfig,
    contract_data: &ContractData,
    secret_states: GuardianDecryptionProofState,
    secret_key_share: GuardianSecretKeyShare,
) -> Result<GuardianDecryptionProof, Error> {
    let ElectionGuardConfig {
        manifest,
        parameters,
    } = app_config.election_guard().await?;
    let context = PreVotingData::compute(
        manifest,
        parameters.clone(),
        &contract_data.guardian_public_keys()?,
    )
    .context("Failed to compute election guard context")?;
    let encrypted_tally = contract_data
        .encrypted_tally
        .as_ref()
        .context("Could not find encrypted tally in app state")?;

    // Find all decryption shares for all included guardians. If the shares
    // registered by a specific guardian cannot be decoded, return
    // `Error::InvalidDecryptionShare`. If the shares are missing, exclude them from
    // the shares used.
    let decryption_shares: Vec<_> = contract_data
        .guardians
        .iter()
        .filter(|(_, guardian_state)| !guardian_state.excluded)
        .filter_map(|(_, guardian_state)| guardian_state.decryption_share.as_ref())
        .map(|bytes| {
            decode::<GuardianDecryption>(bytes).map_err(|_| {
                Error::InvalidDecryptionShare("Invalid decryption shares were detected".into())
            })
        })
        .try_collect()?;

    // Generate the decryption proof for a single contest entry. An error is
    // returned if either:
    //
    // - Shares received from peers cannot be combined
    // - Decryption proof cannot be generated for some ciphertext
    let generate_decryption_proof = |ciphertext: &Ciphertext,
                                     secret_state: &DecryptionProofStateShare,
                                     decryption_shares: Vec<&DecryptionShareResult>|
     -> Result<_, Error> {
        let (commit_shares, decryption_shares): (Vec<_>, Vec<_>) = decryption_shares
            .iter()
            .map(|share| (share.proof_commit.clone(), &share.share))
            .unzip();

        let combined_decryption = CombinedDecryptionShare::combine(&parameters, decryption_shares)
            .map_err(|_| {
                Error::InvalidDecryptionShare("Failed to combine shares received from peers".into())
            })?;
        let proof = DecryptionProof::generate_response_share(
            &parameters.fixed_parameters,
            &context.hashes_ext,
            &context.public_key,
            ciphertext,
            &combined_decryption,
            &commit_shares,
            secret_state,
            &secret_key_share,
        )
        .map_err(|_| {
            Error::InvalidDecryptionShare(
                "Failed to generate the response share to register".into(),
            )
        })?;

        Ok(proof)
    };

    // A map of ciphertexts paired with associated secret state + guardian shares
    // for each contest in the election. Errors are returned if:
    //
    // - Decryption shares do not match the format of the tally
    let mut proofs = BTreeMap::new();
    for (contest_index, ciphertexts) in encrypted_tally {
        let secret_states = match secret_states.get(contest_index) {
            Some(secret_states) if secret_states.len() == ciphertexts.len() => secret_states,
            _ => return Err(anyhow!("Invalid secret states for tally").into()),
        };
        let decryption_shares: Vec<_> = decryption_shares
            .iter()
            .map(|shares| match shares.get(contest_index) {
                Some(shares) if shares.len() == ciphertexts.len() => Ok(shares),
                _ => Err(Error::InvalidDecryptionShare(
                    "Invalid decryption shares detected".into(),
                )),
            })
            .try_collect()?;
        let proofs = proofs
            .entry(*contest_index)
            .or_insert(Vec::with_capacity(ciphertexts.len()));
        for (i, (ciphertext, secret_state)) in ciphertexts.iter().zip(secret_states).enumerate() {
            let decryption_shares = decryption_shares.iter().map(|shares| &shares[i]).collect();
            let proof = generate_decryption_proof(ciphertext, secret_state, decryption_shares)?;
            proofs.push(proof);
        }
    }

    Ok(proofs)
}

/// This command executes the following steps:
///
/// - Generate proof of correct decryption for all ciphertexts in the encrypted
///   tally
/// - Request transaction fee estimate approval from user
/// - Register decryption proofs in the contract
///
/// ## Errors
/// Expected errors include:
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
/// - [`Error::QueryFailed`]
/// - [`Error::DecryptionShareError`] If the invalid decryption shares were
///   detected
#[tauri::command]
pub async fn register_decryption_proofs_flow(
    channel_id: String,
    active_guardian: tauri::State<'_, ActiveGuardianState>,
    app_config: tauri::State<'_, AppConfigState>,
    contract_data: tauri::State<'_, ContractDataState>,
    app_handle: AppHandle,
    window: Window,
) -> Result<(), Error> {
    let cancel = handle_abort(&channel_id, &window);
    let interaction = async {
        let mut app_config = app_config.0.lock().await;
        let contract_data = contract_data.0.lock().await;

        let active_guardian = active_guardian.0.lock().await;
        let active_guardian = active_guardian
            .as_ref()
            .context("Expected guardian account to be available in app state")?;
        let user_config = app_config.user_config();
        let guardian_data_dir = guardian_data_dir(
            &app_handle,
            active_guardian.guardian.account,
            user_config.contract()?,
            user_config.network,
        );
        let secret_key_share = read_encrypted_file(
            &active_guardian.password,
            &guardian_data_dir.join(SECRET_SHARE_FILE),
        )?;
        let secret_states = read_encrypted_file(
            &active_guardian.password,
            &guardian_data_dir.join(DECRYPTION_SECRET_STATES),
        )?;

        let response_shares = generate_decryption_proofs(
            &mut app_config,
            &contract_data,
            secret_states,
            secret_key_share,
        )
        .await?;

        let mut contract = app_config.contract().await?;
        let contract_update = contract
            .post_decryption_proof(&active_guardian.guardian.account, &response_shares)
            .await?;
        let ccd_cost =
            energy_to_ccd(contract_update.current_energy(), &mut contract.0.client).await?;

        // Wait for response from the user through the frontend
        wait_for_approval(&channel_id, &window, &ccd_cost).await?;

        contract_update
            .send(&active_guardian.guardian.keys)
            .await?
            .wait_for_finalization()
            .await?;

        Ok(())
    };

    tokio::select! {
        biased;
        error = cancel => Err(error),
        res = interaction => res
    }
}

/// The data needed by the frontend, representing the current state of a
/// guardian as registered in the election contract
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GuardianStateResponse {
    /// Whether the guardian has registered its encrypted shares
    has_encrypted_shares: bool,
    /// Whether the guardian has registered a public key
    has_public_key:       bool,
    /// The guardian index
    index:                u32,
    /// The guardian status registered for the guardian
    status:               Option<contract::GuardianStatus>,
    /// Whether the guardian has registered a decryption share
    has_decryption_share: bool,
    /// Whether the guardian has proof of correct decryption
    has_decryption_proof: bool,
    /// Whether the guardian is excluded from the tally phase
    excluded:             bool,
}

impl From<&contract::GuardianState> for GuardianStateResponse {
    fn from(value: &contract::GuardianState) -> Self {
        Self {
            has_encrypted_shares: value.encrypted_share.is_some(),
            has_public_key:       value.public_key.is_some(),
            index:                value.index,
            status:               value.status.clone(),
            has_decryption_share: value.decryption_share.is_some(),
            has_decryption_proof: value.decryption_share_proof.is_some(),
            excluded:             value.excluded,
        }
    }
}

/// Synchronizes the stored guardian state with the election contract. Returns a
/// simplified version consisting of the data needed by the frontend
///
/// ## Errors
/// - [`Error::NetworkError`]
#[tauri::command]
pub async fn refresh_guardians(
    app_config: tauri::State<'_, AppConfigState>,
    contract_data: tauri::State<'_, ContractDataState>,
) -> Result<Vec<(AccountAddress, GuardianStateResponse)>, Error> {
    let mut contract = app_config.0.lock().await.contract().await?;
    let guardians_state = contract.guardians_state().await?;

    let response: Vec<_> = guardians_state
        .iter()
        .map(|(account, guardian_state)| (*account, GuardianStateResponse::from(guardian_state)))
        .collect();

    let mut contract_state = contract_data.0.lock().await;
    contract_state.guardians = guardians_state;

    Ok(response)
}

/// Synchronizes the stored encrypted tally with the election contract. Returns
/// a `bool` which signals whether the encrypted tally was found in the contract
/// or not.
///
/// ## Errors
/// - [`Error::NetworkError`]
/// - [`Error::Internal`] If the encrypted tally from the election contract
///   could not be deserialized
#[tauri::command]
pub async fn refresh_encrypted_tally(
    app_config: tauri::State<'_, AppConfigState>,
    contract_data: tauri::State<'_, ContractDataState>,
) -> Result<bool, Error> {
    let mut app_config = app_config.0.lock().await;
    let Some(tally) = app_config.contract().await?.encrypted_tally().await? else {
        return Ok(false);
    };
    let manifest = app_config.election_guard().await?.manifest;

    if !tally
        .keys()
        .all(|k| manifest.contests.indices().contains(k))
    {
        return Err(anyhow!("Malformed tally read from the contract").into());
    }

    let mut stored_tally = contract_data.0.lock().await;
    stored_tally.encrypted_tally = Some(tally);

    Ok(true)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectResponse {
    contract_config:     ElectionConfig,
    election_parameters: ElectionParameters,
}

/// Initializes a connection to the contract and queries the necessary election
/// configuration data. Returns the election configuration stored in the
/// election contract
///
/// ## Errors
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
/// - [`Error::Http`]
#[tauri::command]
pub async fn connect(
    app_config: tauri::State<'_, AppConfigState>,
) -> Result<ConnectResponse, Error> {
    let mut app_config_guard = app_config.0.lock().await;

    let contract_config = app_config_guard.election().await?;
    let eg_config = app_config_guard.election_guard().await?;

    let response = ConnectResponse {
        contract_config,
        election_parameters: eg_config.parameters,
    };
    Ok(response)
}

/// Calculates the [`Amount`] for a given amount of [`Energy`].
///
/// ## Errors
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
async fn energy_to_ccd(energy: Energy, node: &mut v2::Client) -> Result<Amount, Error> {
    let chain_parameters = node
        .get_block_chain_parameters(BlockIdentifier::LastFinal)
        .await?
        .response;
    let amount = chain_parameters.ccd_cost(energy);
    Ok(amount)
}
