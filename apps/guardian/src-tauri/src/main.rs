// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use concordium_rust_sdk::{
    common::encryption::{decrypt, encrypt, EncryptedData, Password},
    id::types::AccountKeys,
    smart_contracts::common::AccountAddress,
    types::WalletAccount,
};
use eg::{
    election_manifest::ElectionManifest, election_parameters::ElectionParameters,
    guardian::GuardianIndex, guardian_secret_key::GuardianSecretKey,
};
use election_common::ByteConvert;
use rand::{thread_rng, Rng};
use std::{
    path::{Path, PathBuf},
    str::FromStr,
    sync::Mutex,
};
use tauri::{App, AppHandle, State};
use util::csprng::Csprng;

/// The file name of the encrypted wallet account.
const WALLET_ACCOUNT_FILE: &str = "guardian-data.json.aes";
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
    #[allow(dead_code)] // TODO: remove when it is used
    password: Password,
    /// The guardian index of the guardian.
    guardian_index: GuardianIndex,
}

#[derive(Default)]
struct ActiveGuardianState(Mutex<Option<ActiveGuardian>>);

struct ElectionGuardConfig {
    #[allow(dead_code)] // TODO: remove when it is used
    manifest: ElectionManifest,
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

fn guardian_data_dir(app_handle: &AppHandle, account: AccountAddress) -> PathBuf {
    app_handle
        .path_resolver()
        .app_data_dir()
        .unwrap() // Path is available as declared in `tauri.conf.json`
        .join(account.to_string())
}

#[derive(thiserror::Error, Debug)]
enum WriteError {
    #[error("Serialization of data type failed")]
    Serialize(#[from] serde_json::Error),
    #[error("{0}")]
    IO(#[from] std::io::Error),
}

fn write_encrypted_file<D: serde::Serialize>(
    password: &Password,
    data: &D,
    file_path: &Path,
) -> Result<(), WriteError> {
    let plaintext = serde_json::to_string(&data)?;
    let mut rng = thread_rng();
    // Serialization will not fail at this point.
    let encrypted_data = serde_json::to_vec(&encrypt(&password, &plaintext, &mut rng)).unwrap();
    std::fs::write(file_path, encrypted_data)?;

    Ok(())
}

/// Describes possible errors when importing an account.
#[derive(thiserror::Error, Debug)]
enum ImportWalletError {
    /// An error happened while trying to write to disk
    #[error("Could not save account: {0}")]
    Write(#[from] WriteError),
    /// Account has already been imported
    #[error("Account already found in application")]
    Duplicate,
}

/// Handle a wallet import. Creates a directory for storing data associated with
/// the guardian account. Fails if the account has already been imported.
///
/// This will create the data directory for the app if it does not already
/// exist.
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
    std::fs::create_dir(&guardian_dir).map_err(WriteError::from)?;

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

/// Represents an IO error happening while loading accounts from disk.
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
enum LoadWalletError {
    /// Decryption of guardian account failed.
    #[error("Failed to decrypt the guardian account")]
    Decryption,
    /// Error when trying to read wallet account file from disk.
    #[error("Could not read the guardian account file")]
    Corrupted,
}

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
    let account_path = guardian_data_dir(&app_handle, account).join(WALLET_ACCOUNT_FILE);
    let encrypted_bytes = std::fs::read(account_path).map_err(|_| LoadWalletError::Corrupted)?;
    let encrypted: EncryptedData =
        serde_json::from_slice(&encrypted_bytes).map_err(|_| LoadWalletError::Corrupted)?;

    let password = Password::from(password);
    let decrypted_bytes =
        decrypt(&password, &encrypted).map_err(|_| LoadWalletError::Decryption)?;
    let guardian_data: GuardianData =
        serde_json::from_reader(&decrypted_bytes[..]).map_err(|_| LoadWalletError::Decryption)?;
    use_guardian(&guardian_data, password, active_guardian_state);

    Ok(guardian_data)
}

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

/// Describes possible errors when loading an account from disk.
#[derive(thiserror::Error, Debug)]
enum GenerateKeyPairError {
    /// Internal error; should not happen.
    #[error("Internal error: {0}")]
    Internal(String),
    /// The guardian has already generated a key.
    #[error("Key pair already generated for guardian")]
    Duplicate,
}

impl From<WriteError> for GenerateKeyPairError {
    fn from(value: WriteError) -> Self {
        GenerateKeyPairError::Internal(value.to_string())
    }
}

impl serde::Serialize for GenerateKeyPairError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Generate a key pair for the selected guardian, storing it on disk.
#[tauri::command(async)]
fn generate_key_pair(
    active_guardian_state: State<ActiveGuardianState>,
    eg_state: State<ElectionGuardState>,
    app_handle: AppHandle,
) -> Result<Vec<u8>, GenerateKeyPairError> {
    let active_guardian_guard = active_guardian_state.0.lock().unwrap();
    let active_guardian = active_guardian_guard
        .as_ref()
        .ok_or(GenerateKeyPairError::Internal(
            "Active account not set".to_string(),
        ))?;
    let account = active_guardian.account;
    let secret_key_path = guardian_data_dir(&app_handle, account).join(SECRET_KEY_FILE);
    if secret_key_path.exists() {
        return Err(GenerateKeyPairError::Duplicate);
    }

    let election_config_guard = eg_state.0.lock().unwrap();
    let election_config = election_config_guard
        .as_ref()
        .ok_or(GenerateKeyPairError::Internal(
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

    let public_key = secret_key.make_public_key();
    let bytes = public_key.encode().unwrap(); // Serialization will not fail
    Ok(bytes)
}

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
