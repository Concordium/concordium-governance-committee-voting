// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{convert::Infallible, fs::File, str::FromStr, sync::Mutex};

use concordium_rust_sdk::{
    common::encryption::{encrypt, Password},
    smart_contracts::common::AccountAddress,
    types::WalletAccount,
};
use rand::thread_rng;
use serde::ser::SerializeStruct;
use tauri::{AppHandle, State};

const WALLET_ACCOUNT_PATH: &str = "wallet-account.json";

#[derive(serde::Deserialize)]
struct GuardianAccount(WalletAccount);

/// Holds the currently selected account and corresponding password
struct ActiveAccount {
    /// The selected account
    account: AccountAddress,
    /// The password used for encryption with the selected account
    password: Password,
}

#[derive(Default)]
struct ActiveAccountState(Mutex<Option<ActiveAccount>>);

impl serde::Serialize for GuardianAccount {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut state = serializer.serialize_struct("GuardianAccount", 2)?;
        state.serialize_field("address", &self.0.address)?;
        state.serialize_field("keys", &self.0.keys)?;
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
    #[error("Could not write file to disk")]
    WriteFileError,
    /// Account has already been imported
    #[error("Account already exists")]
    Duplicate,
}

impl serde::Serialize for ImportWalletError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Stores the account in global state.
fn use_account(account: AccountAddress, password: Password, state: State<ActiveAccountState>) {
    let mut active_account = state.0.lock().unwrap(); // Only errors on panic from other threads
    *active_account = Some(ActiveAccount { account, password });
}

/// Handle a wallet import. Creates a directory for storing data associated with the guardian
/// account. Fails if the account has already been imported, or if the password is infallible.
///
/// This will create the data directory for the app if it does not already exist.
#[tauri::command]
fn import_wallet_account(
    wallet_account: GuardianAccount,
    password: &str,
    state: State<ActiveAccountState>,
    handle: AppHandle,
) -> Result<GuardianAccount, ImportWalletError> {
    let account = wallet_account.0.address;
    let password = Password::from_str(password)?;
    // Serialization will not fail.
    let plaintext = serde_json::to_string(&wallet_account).unwrap();
    let mut rng = thread_rng();
    // Serialization will not fail.
    let encrypted_data = serde_json::to_vec(&encrypt(&password, &plaintext, &mut rng)).unwrap();

    let guardian_dir = handle
        .path_resolver()
        .app_data_dir()
        .unwrap() // Path is available as declared in `tauri.conf.json`
        .join(format!("{}", account));
    std::fs::create_dir_all(&guardian_dir).map_err(|_| ImportWalletError::Duplicate)?;

    let wallet_account_path = guardian_dir.join(WALLET_ACCOUNT_PATH);
    std::fs::write(wallet_account_path, &encrypted_data).map_err(|_| ImportWalletError::WriteFileError)?;

    use_account(wallet_account.0.address, password, state);
    Ok(wallet_account)
}

fn main() {
    tauri::Builder::default()
        .manage(ActiveAccountState::default())
        .invoke_handler(tauri::generate_handler![import_wallet_account])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
