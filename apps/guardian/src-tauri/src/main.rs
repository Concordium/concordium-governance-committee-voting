// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::Context;
use state::{ActiveGuardianState, AppConfigState, ContractDataState};
use tauri::{App, Manager};

mod commands;
mod user_config;
mod config;
pub mod shared;
pub mod state;

use config::AppConfig;

fn handle_setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(debug_assertions)]
    {
        let window = app.get_window("main").unwrap();
        window.open_devtools();
        window.maximize().ok();
    }

    // Will not fail due to being declared accessible in `tauri.conf.json`
    let app_data_dir = app.path_resolver().app_data_dir().unwrap();
    if !app_data_dir.exists() {
        std::fs::create_dir(&app_data_dir).context("Failed to create app data directory")?;
    }

    let app_config = AppConfig::try_from(app.get_cli_matches()?)?;
    app.manage(AppConfigState::from(app_config));
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(handle_setup)
        .manage(ActiveGuardianState::default())
        .manage(ContractDataState::default())
        .invoke_handler(tauri::generate_handler![
            commands::connect,
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
