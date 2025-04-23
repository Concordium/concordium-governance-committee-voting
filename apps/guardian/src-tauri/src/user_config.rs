use std::str::FromStr;

use concordium_rust_sdk::{types::ContractAddress, v2, web3id::did::Network};

// This is isolated in its own module to make it easier to validate the default
// user configuration (found at `resources/default_config.toml`) at build time.

#[derive(Debug)]
pub enum NodeConfig {
    /// Node is determined automatically from the network.
    Auto,
    /// The node endpoint to use. This is a full URL.
    Manual(v2::Endpoint),
}

impl<'de> serde::Deserialize<'de> for NodeConfig {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::de::Deserializer<'de>, {
        let s = String::deserialize(deserializer)?;
        if s == "auto" {
            Ok(NodeConfig::Auto)
        } else {
            let endpoint = v2::Endpoint::from_str(&s).map_err(serde::de::Error::custom)?;
            Ok(NodeConfig::Manual(endpoint))
        }
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct UserConfig {
    pub network:  Network,
    pub node:     NodeConfig,
    #[serde(default)]
    pub contract: Option<ContractAddress>,
}

const DEFAULT_CONFIG: &str = include_str!("../resources/default_config.toml");

impl Default for UserConfig {
    fn default() -> Self {
        // Include the default config file at compile time
        toml_edit::de::from_str(DEFAULT_CONFIG).expect("Can successfully parse default config")
    }
}
