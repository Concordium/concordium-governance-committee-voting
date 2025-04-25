// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::LazyLock;

use commands::read_user_config;
use state::{ActiveGuardianState, AppConfigState, ContractDataState};
use tauri::{App, CustomMenuItem, Manager, Menu, Submenu};

mod commands;
mod config;
pub mod shared;
pub mod state;
mod user_config;

static CONFIG: LazyLock<tauri::Config> = LazyLock::new(|| {
    let config: &[u8] = include_bytes!("../tauri.conf.json");
    serde_json::from_slice::<tauri::Config>(config).expect("Failed to parse tauri.conf.json")
});

static MENU: LazyLock<Menu> = LazyLock::new(|| {
    let open_config = CustomMenuItem::new("config".to_string(), "Open configuration");
    let reload_config = CustomMenuItem::new("reload_config".to_string(), "Reload configuration");
    let settings = Submenu::new(
        "Settings",
        Menu::new()
            .add_item(open_config.clone())
            .add_item(reload_config.clone()),
    );

    let app_name = CONFIG.package.product_name.as_ref().unwrap();

    // Get the default OS menu and add the custom item to the application submenu
    Menu::os_default(app_name).add_submenu(settings)
});

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
        .menu(MENU.clone())
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
