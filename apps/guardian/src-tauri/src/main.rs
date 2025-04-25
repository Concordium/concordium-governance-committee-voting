// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use commands::read_user_config;
use state::{ActiveGuardianState, AppConfigState, ContractDataState};
use tauri::{App, Manager};

mod commands;
mod config;
pub mod shared;
pub mod state;
mod user_config;

fn handle_setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(debug_assertions)]
    {
        let window = app.get_window("main").unwrap();
        window.open_devtools();
        window.maximize().ok();
    }

    let user_config = read_user_config(app.path_resolver())?; // Creates the user config file if it doesn't exist
    app.manage(AppConfigState::from(user_config));

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(handle_setup)
        .manage(ActiveGuardianState::default())
        .manage(ContractDataState::default())
        .invoke_handler(tauri::generate_handler![
            commands::connect,
            commands::reload_config,
            commands::get_accounts,
            commands::import_wallet_account,
            commands::load_account,
            commands::refresh_guardians,
            commands::register_guardian_key_flow,
            commands::register_guardian_shares_flow,
            commands::generate_secret_share_flow,
            commands::refresh_encrypted_tally,
            commands::register_decryption_shares_flow,
            commands::register_decryption_proofs_flow,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
