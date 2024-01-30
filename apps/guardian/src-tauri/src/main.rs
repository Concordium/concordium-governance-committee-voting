// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use concordium_rust_sdk::{
    common::encryption::{decrypt, encrypt, EncryptedData, Password},
    id::types::AccountKeys,
    smart_contracts::common::AccountAddress,
    types::{WalletAccount, Energy},
};
use eg::{
    election_manifest::ElectionManifest, election_parameters::ElectionParameters,
    guardian::GuardianIndex, guardian_public_key::GuardianPublicKey,
    guardian_secret_key::GuardianSecretKey,
};
use election_common::ByteConvert;
use rand::{thread_rng, Rng};
use serde::{de::DeserializeOwned, Serialize};
use std::{
    path::{Path, PathBuf},
    str::FromStr,
    sync::Mutex,
    time::Duration,
};
use tauri::{App, AppHandle, State, Window};
use util::csprng::Csprng;

/// The file name of the encrypted wallet account.
const WALLET_ACCOUNT_FILE: &str = "guardian-data.json.aes";
/// The fiel name of the encrypted secret key for a guardian
const SECRET_KEY_FILE: &str = "secret-key.json.aes";

/// The data stored for a guardian.
#[derive(serde::Serialize, serde::Deserialize)]
struct GuardianData {
    /// The guardian account
    account: AccountAddress,
    /// The keys for the `account`
    keys: AccountKeys,
    /// The guardian index used by election guard
    index: GuardianIndex,
}

impl GuardianData {
    fn create(wallet_account: WalletAccount, index: GuardianIndex) -> Self {
        Self {
            account: wallet_account.address,
            keys: wallet_account.keys,
            index,
        }
    }
}

/// Holds the currently selected account and corresponding password
struct ActiveGuardian {
    /// The selected account
    account: AccountAddress,
    /// The password used for encryption with the selected account
    password: Password,
    /// The guardian index of the guardian.
    guardian_index: GuardianIndex,
}

/// The type of managed state for the active guardian
#[derive(Default)]
struct ActiveGuardianState(Mutex<Option<ActiveGuardian>>);

/// The necessary election guard configuration to construct election guard entities.
struct ElectionGuardConfig {
    /// The election manifest
    #[allow(dead_code)] // TODO: remove when it is used
    manifest: ElectionManifest,
    /// The election parameters
    parameters: ElectionParameters,
}

#[derive(Default)]
struct ElectionGuardState(Mutex<Option<ElectionGuardConfig>>);

impl serde::Serialize for ImportWalletError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Stores the account in global state.
fn use_guardian(guardian: &GuardianData, password: Password, state: State<ActiveGuardianState>) {
    let mut active_account = state.0.lock().unwrap(); // Only errors on panic from other threads
    *active_account = Some(ActiveGuardian {
        account: guardian.account,
        password,
        guardian_index: guardian.index,
    });
}

/// Get the data directory for a guardian account
fn guardian_data_dir(app_handle: &AppHandle, account: AccountAddress) -> PathBuf {
    app_handle
        .path_resolver()
        .app_data_dir()
        .unwrap() // Path is available as declared in `tauri.conf.json`
        .join(account.to_string())
}

/// Possible errors when encrypting data and writing it to disk.
#[derive(thiserror::Error, Debug)]
enum WriteEncryptedError {
    /// Serialization of data type failed
    #[error("Serialization of data type failed")]
    Serialize(#[from] serde_json::Error),
    /// [`std::io::Error`] while attempting to write to disk
    #[error("{0}")]
    IO(#[from] std::io::Error),
}

/// Writes `data` encrypted with `password` to disk
fn write_encrypted_file<D: serde::Serialize>(
    password: &Password,
    data: &D,
    file_path: &Path,
) -> Result<(), WriteEncryptedError> {
    let plaintext = serde_json::to_string(&data)?;
    let mut rng = thread_rng();
    // Serialization will not fail at this point.
    let encrypted_data = serde_json::to_vec(&encrypt(&password, &plaintext, &mut rng)).unwrap();
    std::fs::write(file_path, encrypted_data)?;

    Ok(())
}

/// Errors which happen when reading an encrypted file.
#[derive(thiserror::Error, Debug)]
enum ReadEncryptedError {
    /// Decryption of file contents failed
    #[error("Decryption of data failed")]
    Decrypt,
    /// [`std::io::Error`] while attempting to write to disk
    #[error("{0}")]
    IO(#[from] std::io::Error),
    /// Could not deserialize into encrypted data
    #[error("File corruption detected for {0}")]
    Corrupted(PathBuf),
}

impl From<serde_json::Error> for ReadEncryptedError {
    fn from(_: serde_json::Error) -> Self {
        ReadEncryptedError::Decrypt
    }
}

/// Deserialize contents of an encrypted file.
fn read_encrypted_file<D: serde::de::DeserializeOwned>(
    password: &Password,
    file_path: &PathBuf,
) -> Result<D, ReadEncryptedError> {
    let encrypted_bytes = std::fs::read(file_path)?;
    let encrypted: EncryptedData = serde_json::from_slice(&encrypted_bytes)
        .map_err(|_| ReadEncryptedError::Corrupted(file_path.clone()))?;

    let decrypted_bytes =
        decrypt(&password, &encrypted).map_err(|_| ReadEncryptedError::Decrypt)?;
    let value =
        serde_json::from_slice(&decrypted_bytes).map_err(|_| ReadEncryptedError::Decrypt)?;
    Ok(value)
}

/// Describes possible errors when importing an account.
#[derive(thiserror::Error, Debug)]
enum ImportWalletError {
    /// An error happened while trying to write to disk
    #[error("Could not save account: {0}")]
    Write(#[from] WriteEncryptedError),
    /// Account has already been imported
    #[error("Account already found in application")]
    Duplicate,
}

/// Handle a wallet import. Creates a directory for storing data associated with
/// the guardian account.
///
/// This will create the data directory for the app if it does not already
/// exist.
///
/// ## Errors
/// Fails if the account has already been imported or if the guardian data could not be written to
/// disk (which should not happen).
#[tauri::command(async)]
fn import_wallet_account(
    wallet_account: WalletAccount,
    guardian_index: GuardianIndex,
    password: String,
    active_guardian_state: State<ActiveGuardianState>,
    app_handle: AppHandle,
) -> Result<GuardianData, ImportWalletError> {
    let account = wallet_account.address;

    let guardian_dir = guardian_data_dir(&app_handle, account);
    if guardian_dir.exists() {
        return Err(ImportWalletError::Duplicate);
    }
    std::fs::create_dir(&guardian_dir).map_err(WriteEncryptedError::from)?;

    let password = Password::from(password);
    let guardian_data = GuardianData::create(wallet_account, guardian_index);
    write_encrypted_file(
        &password,
        &guardian_data,
        &guardian_dir.join(WALLET_ACCOUNT_FILE),
    )?;
    use_guardian(&guardian_data, password, active_guardian_state);

    Ok(guardian_data)
}

/// Represents an IO error happening while loading accounts from disk. This should never happen in
/// practice due to accounts being loaded right after ensuring the data directory for the
/// application exists during setup.
#[derive(thiserror::Error, Debug)]
#[error("Could not read app data")]
struct GetAccountsError(#[from] std::io::Error);

impl serde::Serialize for GetAccountsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Gets the accounts which have previously been imported into the application.
///
/// ## Errors
/// Fails if the appliction data directory could not be read, which should not happen due to
/// ensuring the existence during application setup.
#[tauri::command(async)]
fn get_accounts(handle: AppHandle) -> Result<Vec<AccountAddress>, GetAccountsError> {
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

/// Describes possible errors when loading an account from disk.
#[derive(thiserror::Error, Debug)]
#[error("Failed to load guardian account: {0}")]
struct LoadWalletError(#[from] ReadEncryptedError);

impl serde::Serialize for LoadWalletError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Load a [`GuardianAccount`] from disk, decrypting the contents with
/// `password`
#[tauri::command(async)]
fn load_account(
    account: AccountAddress,
    password: String,
    app_handle: AppHandle,
    active_guardian_state: State<ActiveGuardianState>,
) -> Result<GuardianData, LoadWalletError> {
    let password = Password::from(password);
    let account_path = guardian_data_dir(&app_handle, account).join(WALLET_ACCOUNT_FILE);
    let guardian_data: GuardianData = read_encrypted_file(&password, &account_path)?;
    use_guardian(&guardian_data, password, active_guardian_state);

    Ok(guardian_data)
}

/// Set the election guard configuration necessary to construct election guard entities.
#[tauri::command(async)]
fn set_eg_config(
    manifest: ElectionManifest,
    parameters: ElectionParameters,
    state: State<ElectionGuardState>,
) {
    let mut active_account = state.0.lock().unwrap(); // Only errors on panic from other threads
    *active_account = Some(ElectionGuardConfig {
        manifest,
        parameters,
    });
}

/// Describes possible errors when loading an account from disk. None of the variants happen due to
/// user behaviour.
#[derive(thiserror::Error, Debug)]
enum GenerateKeyPairError {
    /// Missing application state. Should not happen due to user behavioiur.
    #[error("Application state missing: {0}")]
    MissingState(String),
    /// The guardian has already generated a key. Should only happen due to corruption of file.
    #[error("Existing key found, but could not be read: {0}")]
    ReadExisting(#[from] ReadEncryptedError),
    /// The key could not be written to disk. Should not happen due to user behaviour.
    #[error("Could not write the key to disk: {0}")]
    Write(#[from] WriteEncryptedError),
}

impl serde::Serialize for GenerateKeyPairError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Generate a key pair for the selected guardian, storing the secret key on disk and returning the
/// public key. If the secret key already exists, it returns the corresponding public key.
///
/// ## Errors
/// Any errors happening will be due to data corruption or internal errors.
#[tauri::command(async)]
fn generate_key_pair(
    active_guardian_state: State<ActiveGuardianState>,
    eg_state: State<ElectionGuardState>,
    app_handle: AppHandle,
) -> Result<GuardianPublicKey, GenerateKeyPairError> {
    let active_guardian_guard = active_guardian_state.0.lock().unwrap();
    let active_guardian =
        active_guardian_guard
            .as_ref()
            .ok_or(GenerateKeyPairError::MissingState(
                "Active account not set".to_string(),
            ))?;
    let account = active_guardian.account;
    let secret_key_path = guardian_data_dir(&app_handle, account).join(SECRET_KEY_FILE);

    let secret_key = if secret_key_path.exists() {
        let secret_key = read_encrypted_file(&active_guardian.password, &secret_key_path)?;
        secret_key
    } else {
        let election_config_guard = eg_state.0.lock().unwrap();
        let election_config =
            election_config_guard
                .as_ref()
                .ok_or(GenerateKeyPairError::MissingState(
                    "Election config not set".to_string(),
                ))?;
        let seed: [u8; 32] = thread_rng().gen();
        let mut csprng = Csprng::new(&seed);
        let secret_key = GuardianSecretKey::generate(
            &mut csprng,
            &election_config.parameters,
            active_guardian.guardian_index,
            account.to_string().into(),
        );
        write_encrypted_file(&active_guardian.password, &secret_key, &secret_key_path)?;
        secret_key
    };

    let public_key = secret_key.make_public_key();
    Ok(public_key)
}

/// Sends a message to the current [`Window`] and waits for a response. Uses the supplied `id` as
/// the event channel.
async fn send_message<M, R>(
    window: &Window,
    id: &str,
    message: M,
) -> Result<R, GenerateKeyPairError>
where
    M: Serialize + Clone,
    R: DeserializeOwned + Sync + Send + 'static,
{
    // Construct the message channel and setup response listener
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window.once(id, move |e| {
        let response: R = serde_json::from_str(e.payload().unwrap()).unwrap(); // Clean up unwrap
        if sender.send(response).is_ok() {
            println!("message received");
        }
    });

    // Send the message
    window.emit(id, message).unwrap();

    // Wait for the response
    let response = receiver
        .await
        .map_err(|_| GenerateKeyPairError::MissingState("something".into()))?; // TODO: change..
    Ok(response)
}

#[tauri::command]
async fn send_public_key_registration<'a>(
    active_guardian_state: State<'a, ActiveGuardianState>,
    eg_state: State<'a, ElectionGuardState>,
    channel_id: String,
    app_handle: AppHandle,
    window: Window,
) -> Result<(), GenerateKeyPairError> {
    eprintln!("START");
    let public_key = generate_key_pair(active_guardian_state, eg_state, app_handle)?;
    eprintln!("PUB KEY {:?}", public_key);
    let response: bool = send_message(&window, &channel_id, Energy { energy: 400 }).await?;
    eprintln!("RESPONSE {}", response);

    // Continue the work
    tokio::time::sleep(Duration::from_secs(3)).await;
    eprintln!("END");
    Ok(())
}

/// Ensures the necessary directories are available for the application to function.
fn setup_app(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    // Will not fail due to being declared accessible in `tauri.conf.json`
    let app_data_dir = app.path_resolver().app_data_dir().unwrap();
    if !app_data_dir.exists() {
        std::fs::create_dir(&app_data_dir)?;
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(setup_app)
        .manage(ActiveGuardianState::default())
        .manage(ElectionGuardState::default())
        .invoke_handler(tauri::generate_handler![
            import_wallet_account,
            get_accounts,
            load_account,
            set_eg_config,
            generate_key_pair,
            send_public_key_registration,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
