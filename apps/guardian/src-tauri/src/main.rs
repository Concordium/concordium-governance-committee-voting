// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{convert::Infallible, str::FromStr, sync::Mutex};

use concordium_rust_sdk::{
    common::encryption::{decrypt, encrypt, EncryptedData, Password},
    smart_contracts::common::AccountAddress,
    types::WalletAccount,
};
use eg::{
    election_manifest::ElectionManifest, election_parameters::ElectionParameters,
    guardian::GuardianIndex, guardian_public_key::GuardianPublicKey,
    guardian_secret_key::GuardianSecretKey,
};
use rand::{thread_rng, Rng};
use serde::ser::SerializeStruct;
use tauri::{AppHandle, State};
use util::csprng::Csprng;

/// The file name of the encrypted wallet account.
const WALLET_ACCOUNT_FILE: &str = "wallet-account.json";

/// Wrapper around [`WalletAccount`]
#[derive(serde::Deserialize)]
struct GuardianAccount(WalletAccount);

impl From<WalletAccount> for GuardianAccount {
    fn from(value: WalletAccount) -> Self { GuardianAccount(value) }
}

/// The data stored for a guardian.
#[derive(serde::Serialize, serde::Deserialize)]
struct Guardian {
    /// The guardian account
    account: GuardianAccount,
    /// The guardian index used by election guard
    index:   GuardianIndex,
}

/// Holds the currently selected account and corresponding password
struct ActiveAccount {
    /// The selected account
    account:        AccountAddress,
    /// The password used for encryption with the selected account
    #[allow(dead_code)] // TODO: remove when it is used
    password: Password,
    /// The guardian index of the guardian.
    guardian_index: GuardianIndex,
}

#[derive(Default)]
struct ActiveAccountState(Mutex<Option<ActiveAccount>>);

struct ElectionGuardConfig {
    #[allow(dead_code)] // TODO: remove when it is used
    manifest: ElectionManifest,
    parameters: ElectionParameters,
}

#[derive(Default)]
struct ElectionGuardState(Mutex<Option<ElectionGuardConfig>>);

impl serde::Serialize for GuardianAccount {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
        let mut state = serializer.serialize_struct("GuardianAccount", 2)?;
        state.serialize_field("address", &self.0.address)?;
        state.serialize_field("accountKeys", &self.0.keys)?;
        state.end()
    }
}

/// Describes possible errors when importing an account.
#[derive(thiserror::Error, Debug)]
enum ImportWalletError {
    /// The given password cannot be used.
    #[error(transparent)]
    InvalidPassword(#[from] Infallible),
    /// An error happened while trying to write to disk
    #[error("Could save account")]
    Write(#[from] std::io::Error),
    /// Account has already been imported
    #[error("Account already found in application")]
    Duplicate,
}

impl serde::Serialize for ImportWalletError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Stores the account in global state.
fn use_account(
    account: AccountAddress,
    password: Password,
    guardian_index: GuardianIndex,
    state: State<ActiveAccountState>,
) {
    let mut active_account = state.0.lock().unwrap(); // Only errors on panic from other threads
    *active_account = Some(ActiveAccount {
        account,
        password,
        guardian_index,
    });
}

/// Handle a wallet import. Creates a directory for storing data associated with
/// the guardian account. Fails if the account has already been imported, or if
/// the password is infallible.
///
/// This will create the data directory for the app if it does not already
/// exist.
#[tauri::command(async)]
fn import_wallet_account(
    wallet_account: GuardianAccount,
    guardian_index: GuardianIndex,
    password: &str,
    state: State<ActiveAccountState>,
    handle: AppHandle,
) -> Result<GuardianAccount, ImportWalletError> {
    let account = wallet_account.0.address;
    let password = Password::from_str(password)?;
    let guardian_data = Guardian {
        account: wallet_account,
        index:   guardian_index,
    };
    // Serialization will not fail.
    let plaintext = serde_json::to_string(&guardian_data).unwrap();
    let mut rng = thread_rng();
    // Serialization will not fail.
    let encrypted_data = serde_json::to_vec(&encrypt(&password, &plaintext, &mut rng)).unwrap();

    let guardian_dir = handle
        .path_resolver()
        .app_data_dir()
        .unwrap() // Path is available as declared in `tauri.conf.json`
        .join(format!("{}", account));

    if guardian_dir.exists() {
        return Err(ImportWalletError::Duplicate);
    }
    std::fs::create_dir_all(&guardian_dir)?;

    let wallet_account_path = guardian_dir.join(WALLET_ACCOUNT_FILE);
    std::fs::write(wallet_account_path, encrypted_data)?;

    use_account(account, password, guardian_index, state);
    Ok(guardian_data.account)
}

/// Represents an IO error happening while loading accounts from disk.
#[derive(thiserror::Error, Debug)]
#[error("Could not read app data")]
struct GetAccountsError(#[from] std::io::Error);

impl serde::Serialize for GetAccountsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
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
    /// The given password is incorrect.
    #[error("Incorrect password")]
    IncorrectPassword,
    /// Error when trying to read wallet account file from disk.
    #[error("Guardian account file corrupted")]
    Corrupted,
}

impl serde::Serialize for LoadWalletError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Load a [`GuardianAccount`] from disk, decrypting the contents with
/// `password`
#[tauri::command(async)]
fn load_account(
    account: AccountAddress,
    password: &str,
    handle: AppHandle,
) -> Result<GuardianAccount, LoadWalletError> {
    let account_path = handle
        .path_resolver()
        .app_data_dir()
        .unwrap()
        .join(format!("{}/{WALLET_ACCOUNT_FILE}", account));
    let password = Password::from_str(password).map_err(|_| LoadWalletError::IncorrectPassword)?;

    let encrypted_bytes = std::fs::read(account_path).map_err(|_| LoadWalletError::Corrupted)?;
    let encrypted: EncryptedData =
        serde_json::from_slice(&encrypted_bytes).map_err(|_| LoadWalletError::Corrupted)?;

    let decrypted_bytes =
        decrypt(&password, &encrypted).map_err(|_| LoadWalletError::IncorrectPassword)?;
    let json_str = std::str::from_utf8(&decrypted_bytes).map_err(|_| LoadWalletError::Corrupted)?;
    let wallet_account =
        WalletAccount::from_json_str(json_str).map_err(|_| LoadWalletError::Corrupted)?;
    Ok(wallet_account.into())
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
    #[error("{0}")]
    Internal(String),
}

impl serde::Serialize for GenerateKeyPairError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[tauri::command(async)]
fn generate_key_pair(
    account_state: State<ActiveAccountState>,
    eg_state: State<ElectionGuardState>,
) -> Result<GuardianPublicKey, GenerateKeyPairError> {
    let seed: [u8; 32] = thread_rng().gen();
    let mut csprng = Csprng::new(&seed);
    let election_config_guard = eg_state.0.lock().unwrap();
    let election_config = election_config_guard
        .as_ref()
        .ok_or(GenerateKeyPairError::Internal(
            "Election config not set".to_string(),
        ))?;
    let active_account_guard = account_state.0.lock().unwrap();
    let active_account = active_account_guard
        .as_ref()
        .ok_or(GenerateKeyPairError::Internal(
            "Active account not set".to_string(),
        ))?;

    let secret_key = GuardianSecretKey::generate(
        &mut csprng,
        &election_config.parameters,
        active_account.guardian_index,
        active_account.account.to_string().into(),
    );
    let public_key = secret_key.make_public_key();
    Ok(public_key)
}

fn main() {
    tauri::Builder::default()
        .manage(ActiveAccountState::default())
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
