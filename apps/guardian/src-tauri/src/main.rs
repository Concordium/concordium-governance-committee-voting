// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use concordium_rust_sdk::{
    common::encryption::{decrypt, encrypt, EncryptedData, Password},
    smart_contracts::common::AccountAddress,
    types::WalletAccount,
};
use rand::thread_rng;
use serde::ser::SerializeStruct;
use std::{str::FromStr, sync::Mutex};
use tauri::{AppHandle, State};

/// The file name of the encrypted wallet account.
const WALLET_ACCOUNT_FILE: &str = "wallet-account.json";

/// Wrapper around [`WalletAccount`]
#[derive(serde::Deserialize)]
struct GuardianAccount(WalletAccount);

impl From<WalletAccount> for GuardianAccount {
    fn from(value: WalletAccount) -> Self { GuardianAccount(value) }
}

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

/// Holds the currently selected account and corresponding password
struct ActiveAccount {
    /// The selected account
    #[allow(dead_code)] // TODO: remove when it is used
    account: AccountAddress,
    /// The password used for encryption with the selected account
    #[allow(dead_code)] // TODO: remove when it is used
    password: Password,
}

#[derive(Default)]
struct ActiveAccountState(Mutex<Option<ActiveAccount>>);

/// Describes possible errors when importing an account.
#[derive(thiserror::Error, Debug)]
enum ImportWalletError {
    /// An error happened while trying to write to disk
    #[error("Could not save account: {0}")]
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
fn use_account(account: AccountAddress, password: Password, state: State<ActiveAccountState>) {
    let mut active_account = state.0.lock().unwrap(); // Only errors on panic from other threads
    *active_account = Some(ActiveAccount { account, password });
}

/// Handle a wallet import. Creates a directory for storing data associated with
/// the guardian account. Fails if the account has already been imported.
///
/// This will create the data directory for the app if it does not already
/// exist.
#[tauri::command(async)]
fn import_wallet_account(
    wallet_account: GuardianAccount,
    password: String,
    active_account_state: State<ActiveAccountState>,
    app_handle: AppHandle,
) -> Result<GuardianAccount, ImportWalletError> {
    let account = wallet_account.0.address;
    let password = Password::from(password);
    // Serialization will not fail.
    let plaintext = serde_json::to_string(&wallet_account).unwrap();
    let mut rng = thread_rng();
    // Serialization will not fail.
    let encrypted_data = serde_json::to_vec(&encrypt(&password, &plaintext, &mut rng)).unwrap();

    let guardian_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .unwrap() // Path is available as declared in `tauri.conf.json`
        .join(account.to_string());

    if guardian_dir.exists() {
        return Err(ImportWalletError::Duplicate);
    }
    std::fs::create_dir_all(&guardian_dir)?;

    let wallet_account_path = guardian_dir.join(WALLET_ACCOUNT_FILE);
    std::fs::write(wallet_account_path, encrypted_data)?;

    use_account(wallet_account.0.address, password, active_account_state);
    Ok(wallet_account)
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
        S: serde::Serializer, {
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
    active_account_state: State<ActiveAccountState>,
) -> Result<GuardianAccount, LoadWalletError> {
    let account_path = app_handle
        .path_resolver()
        .app_data_dir()
        .unwrap() // As declared in `tauri.conf.json`, we have access
        .join(account.to_string())
        .join(WALLET_ACCOUNT_FILE);
    let password = Password::from(password);

    let encrypted_bytes = std::fs::read(account_path).map_err(|_| LoadWalletError::Corrupted)?;
    let encrypted: EncryptedData =
        serde_json::from_slice(&encrypted_bytes).map_err(|_| LoadWalletError::Corrupted)?;

    let decrypted_bytes =
        decrypt(&password, &encrypted).map_err(|_| LoadWalletError::Decryption)?;
    let wallet_account = WalletAccount::from_json_reader(&decrypted_bytes[..])
        .map_err(|_| LoadWalletError::Decryption)?;
    use_account(wallet_account.address, password, active_account_state);

    Ok(wallet_account.into())
}

fn main() {
    tauri::Builder::default()
        .manage(ActiveAccountState::default())
        .invoke_handler(tauri::generate_handler![
            import_wallet_account,
            get_accounts,
            load_account
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
