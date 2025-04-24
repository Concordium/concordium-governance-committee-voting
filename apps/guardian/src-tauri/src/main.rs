// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::str::FromStr;

use anyhow::Context;
use state::{ActiveGuardianState, AppConfigState, ContractDataState};
use tauri::{App, Manager};

mod commands;
mod config;
pub mod shared;
pub mod state;
mod user_config;

use user_config::{PartialUserConfig, UserConfig};

fn handle_setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(debug_assertions)]
    {
        let window = app.get_window("main").unwrap();
        window.open_devtools();
        window.maximize().ok();
    }

    let app_config_dir = app.path_resolver().app_config_dir().unwrap();
    if !app_config_dir.exists() {
        std::fs::create_dir(&app_config_dir).context("Failed to create app config directory")?;
    }
    let config_path = app_config_dir.join(UserConfig::FILENAME);
    if !config_path.exists() {
        std::fs::write(&config_path, PartialUserConfig::empty().get_toml())
            .context("Failed to create user config")?;
    }

    let file = std::fs::read_to_string(config_path)?;
    let user_config = PartialUserConfig::from_str(&file)?.full_config();
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
