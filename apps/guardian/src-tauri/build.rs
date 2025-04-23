#[path = "src/user_config.rs"]
mod user_config;

use user_config::DefaultUserConfig;

fn main() {
    // Parse the config and validate it at build time
    // This will cause a build error if the default config is invalid
    let config_content = include_str!("resources/default_config.toml");
    toml_edit::de::from_str::<DefaultUserConfig>(config_content)
        .expect("Can successfully parse default config");

    tauri_build::build();
}
