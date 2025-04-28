// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{str::FromStr, sync::LazyLock};

use commands::{read_user_config, user_config_path};
use log::LevelFilter;
use state::{ActiveGuardianState, AppConfigState, ContractDataState};
use strum::{Display, EnumIter, EnumMessage, EnumString, IntoEnumIterator};
use tauri::{App, CustomMenuItem, Manager, Menu, Submenu};
use tauri_plugin_log::LogTarget;

mod commands;
mod config;
pub mod shared;
pub mod state;
mod user_config;

static CONFIG: LazyLock<tauri::Config> = LazyLock::new(|| {
    let config: &[u8] = include_bytes!("../tauri.conf.json");
    serde_json::from_slice::<tauri::Config>(config).expect("Failed to parse tauri.conf.json")
});

#[derive(Debug, Display, EnumString, EnumMessage, EnumIter)]
enum SettingsMenuEvent {
    #[strum(serialize = "config", message = "Open configuration")]
    Config,
    #[strum(serialize = "reload_config", message = "Reload configuration")]
    ReloadConfig,
}

static MENU: LazyLock<Menu> = LazyLock::new(|| {
    let settings = SettingsMenuEvent::iter()
        .map(|event| CustomMenuItem::new(event.to_string(), event.get_message().unwrap()))
        .fold(Menu::new(), |menu, item| menu.add_item(item));

    // TODO: On macOS, the convention is to add configuration/settings under the
    // first sub-menu in the application menu. This could be an optimization for
    // the future
    let settings = Submenu::new("Settings", settings);

    let app_name = CONFIG
        .package
        .product_name
        .as_ref()
        .expect("Product name should be available");

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

fn handle_menu_event(event: tauri::WindowMenuEvent) {
    let item = event.menu_item_id();
    let app = event.window().app_handle();

    let Ok(item) = SettingsMenuEvent::from_str(item) else {
        return;
    };

    match item {
        SettingsMenuEvent::Config => {
            let path =
                user_config_path(app.path_resolver()).expect("User config should be accessible");
            open::that(path).expect("Failed to open configuration directory");
        }
        SettingsMenuEvent::ReloadConfig => {
            tauri::async_runtime::spawn(async move {
                let app_clone = app.clone();
                let config_state = app_clone.state::<AppConfigState>();
                let _ = commands::reload_config(config_state, app, event.window().clone()).await;
            });
        }
    }
}

fn main() {
    let log_plugin = tauri_plugin_log::Builder::default()
        .level(LevelFilter::Info)
        .targets([LogTarget::LogDir, LogTarget::Stdout, LogTarget::Webview])
        .build();
    log_print_panics::init();

    tauri::Builder::default()
        .setup(handle_setup)
        .plugin(log_plugin)
        .menu(MENU.clone())
        .on_menu_event(handle_menu_event)
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
