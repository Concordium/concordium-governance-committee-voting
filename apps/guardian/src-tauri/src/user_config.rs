use std::str::FromStr;

use concordium_rust_sdk::{types::ContractAddress, v2, web3id::did::Network};
use serde::Deserialize;

// This is isolated in its own module to make it easier to validate the default
// user configuration (found at `resources/default_config.toml`) at build time.

/// Represents the node configuration for the application.
#[derive(Debug, Default, serde::Serialize, serde::Deserialize, Clone)]
pub enum NodeConfig {
    /// Node is determined automatically from the network.
    #[default]
    #[serde(rename = "auto")]
    Auto,
    /// The node endpoint to use. This is a full URL.
    #[serde(
        deserialize_with = "deserialize_endpoint",
        serialize_with = "serialize_endpoint"
    )]
    Manual(v2::Endpoint),
}

fn deserialize_endpoint<'de, D>(deserializer: D) -> Result<v2::Endpoint, D::Error>
where
    D: serde::Deserializer<'de>, {
    let s = String::deserialize(deserializer)?;
    v2::Endpoint::from_str(&s).map_err(serde::de::Error::custom)
}

fn serialize_endpoint<S>(endpoint: &v2::Endpoint, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer, {
    let s = endpoint.uri().to_string();
    serializer.serialize_str(&s)
}

const DEFAULT_NODE_TESTNET: &str = "https://grpc.testnet.concordium.com:20000";
const DEFAULT_NODE_MAINNET: &str = "https://grpc.mainnet.concordium.software:20000";

impl NodeConfig {
    pub fn default_endpoint(network: Network) -> v2::Endpoint {
        match network {
            Network::Testnet => v2::Endpoint::from_str(DEFAULT_NODE_TESTNET).unwrap(),
            Network::Mainnet => v2::Endpoint::from_str(DEFAULT_NODE_MAINNET).unwrap(),
        }
    }

    pub fn endpoint(&self, network: Network) -> v2::Endpoint {
        let NodeConfig::Manual(endpoint) = self else {
            return Self::default_endpoint(network);
        };

        endpoint.clone()
    }
}

/// The user configuration for the application. This matches [`UserConfig`] but
/// with non-optional fields.
#[derive(Debug, serde::Deserialize)]
pub struct UserConfig {
    /// The network id.
    pub network:  Network,
    /// Describes the node endpoint to use.
    #[serde(default)]
    pub node:     NodeConfig,
    /// The contract address of the election.
    #[serde(default)]
    pub contract: Option<ContractAddress>,
}

// Include the default config file at compile time
const DEFAULT_CONFIG: &str = include_str!("../resources/default_config.toml");

impl Default for UserConfig {
    fn default() -> Self {
        // This is already checked in `build.rs` so we can unwrap here
        toml_edit::de::from_str(DEFAULT_CONFIG).expect("Can successfully parse default config")
    }
}

impl From<PartialUserConfig> for UserConfig {
    fn from(config: PartialUserConfig) -> Self {
        let default = Self::default();
        Self {
            network:  config.network.unwrap_or(default.network),
            node:     config.node.unwrap_or(default.node),
            contract: config.contract,
        }
    }
}

impl UserConfig {
    pub const FILE: &'static str = "config.toml";

    pub fn node(&self) -> v2::Endpoint { self.node.endpoint(self.network) }
}

/// Represents a partial [`UserConfig`], which is what will be written to the
/// users disk and merged with [`UserConfig::default`] to form the complete
/// application config.
#[derive(Debug, serde::Serialize, Clone)]
pub struct PartialUserConfig {
    /// The network id.
    pub network:  Option<Network>,
    /// Describes the node endpoint to use.
    pub node:     Option<NodeConfig>,
    /// The contract address of the election.
    pub contract: Option<ContractAddress>,
}

impl From<UserConfig> for PartialUserConfig {
    fn from(config: UserConfig) -> Self {
        Self {
            network:  Some(config.network),
            node:     Some(config.node),
            contract: config.contract,
        }
    }
}

impl Default for PartialUserConfig {
    fn default() -> Self { Self::from(UserConfig::default()) }
}

impl<'de> serde::Deserialize<'de> for PartialUserConfig {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::de::Deserializer<'de>, {
        let mut user_config = PartialUserConfig::default();

        let map = serde_json::Value::deserialize(deserializer)?;
        if let Some(network) = map.get("network") {
            user_config.network =
                serde_json::from_value(network.clone()).map_err(serde::de::Error::custom)?;
        }
        if let Some(node) = map.get("node") {
            user_config.node =
                serde_json::from_value(node.clone()).map_err(serde::de::Error::custom)?;
        }
        if let Some(contract) = map.get("contract") {
            user_config.contract =
                serde_json::from_value(contract.clone()).map_err(serde::de::Error::custom)?;
        }

        Ok(user_config)
    }
}

impl PartialUserConfig {
    /// Creates an empty configuration.
    pub fn empty() -> Self {
        Self {
            network:  None,
            node:     None,
            contract: None,
        }
    }

    /// Creates a new [`UserConfig`] for an election defined by the network id
    /// and the contract address.
    pub fn with_election(network: Network, contract: ContractAddress) -> Self {
        Self {
            network: Some(network),
            contract: Some(contract),
            ..Default::default()
        }
    }

    pub fn full_config(&self) -> UserConfig { UserConfig::from(self.clone()) }

    /// Gets the toml representation of the [`UserConfig`], annotated with
    /// comments.
    pub fn get_toml(&self) -> String {
        let mut document =
            toml_edit::ser::to_document(self).expect("UserConfig should serialize to TOML");

        // Annotate the document with comments for all fields
        if let Some(item) = document.get_mut("network") {
            item.as_value_mut()
                .unwrap()
                .decor_mut()
                .set_suffix(r#" # The network id. Must be either "mainnet" or "testnet"."#);
        }

        if let Some(item) = document.get_mut("node") {
            item.as_value_mut()
                .unwrap()
                .decor_mut()
                .set_suffix(r#" # Can be set to either "auto", or a url pointing to the GRPC API of a Concordium node, e.g. "https://grpc.mainnet.concordium.software:20000". Setting to "auto" results in automatic determination of the endpoint depending on the "network"."#);
        }

        if let Some(item) = document.get_mut("contract") {
            // Convert the contract to a table
            let mut contract_table = item.clone().into_table().unwrap();
            contract_table.decor_mut().set_prefix(
                r#"
# The contract address of the election. Must be a valid contract address for the network specified in the config.
"#,
            );

            if let Some(index) = contract_table.get_mut("index") {
                index
                    .as_value_mut()
                    .unwrap()
                    .decor_mut()
                    .set_suffix(r#" # The index of the contract. Must be an unsigned integer."#);
            }

            if let Some(subindex) = contract_table.get_mut("subindex") {
                subindex
                    .as_value_mut()
                    .unwrap()
                    .decor_mut()
                    .set_suffix(r#" # The subindex of the contract. Must be an unsigned integer."#);
            }

            document["contract"] = contract_table.into();
        }

        document.to_string().trim().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use concordium_rust_sdk::{types::ContractAddress, web3id::did::Network};

    #[test]
    fn test_get_toml_full() {
        let user_config = PartialUserConfig {
            network:  Some(Network::Mainnet),
            node:     Some(NodeConfig::Auto),
            contract: Some(ContractAddress {
                index:    1,
                subindex: 0,
            }),
        };

        let toml_output = user_config.get_toml();
        let expected = r#"network = "mainnet" # The network id. Must be either "mainnet" or "testnet".
node = "auto" # Can be set to either "auto", or a url pointing to the GRPC API of a Concordium node, e.g. "https://grpc.mainnet.concordium.software:20000". Setting to "auto" results in automatic determination of the endpoint depending on the "network".

# The contract address of the election. Must be a valid contract address for the network specified in the config.
[contract]
index = 1 # The index of the contract. Must be an unsigned integer.
subindex = 0 # The subindex of the contract. Must be an unsigned integer."#;

        assert_eq!(toml_output, expected);

        toml_edit::de::from_str::<PartialUserConfig>(&expected)
            .expect("Should be able to parse the toml output");
    }

    #[test]
    fn test_get_toml_default() {
        let user_config = PartialUserConfig::default();

        let toml_output = user_config.get_toml();
        let expected = r#"network = "mainnet" # The network id. Must be either "mainnet" or "testnet".
node = "auto" # Can be set to either "auto", or a url pointing to the GRPC API of a Concordium node, e.g. "https://grpc.mainnet.concordium.software:20000". Setting to "auto" results in automatic determination of the endpoint depending on the "network"."#;

        assert_eq!(toml_output, expected);

        toml_edit::de::from_str::<PartialUserConfig>(&expected)
            .expect("Should be able to parse the toml output");
    }

    #[test]
    fn test_get_toml_partial() {
        let user_config = PartialUserConfig {
            network:  None,
            node:     None,
            contract: Some(ContractAddress {
                index:    1,
                subindex: 0,
            }),
        };

        let toml_output = user_config.get_toml();
        let expected = r#"# The contract address of the election. Must be a valid contract address for the network specified in the config.
[contract]
index = 1 # The index of the contract. Must be an unsigned integer.
subindex = 0 # The subindex of the contract. Must be an unsigned integer."#;

        assert_eq!(toml_output, expected);

        toml_edit::de::from_str::<PartialUserConfig>(&expected)
            .expect("Should be able to parse the toml output");
    }

    #[test]
    fn test_get_toml_empty() {
        let user_config = PartialUserConfig {
            network:  None,
            node:     None,
            contract: None,
        };

        let toml_output = user_config.get_toml();
        let expected = "";

        assert_eq!(toml_output, expected);

        toml_edit::de::from_str::<PartialUserConfig>(&expected)
            .expect("Should be able to parse the toml output");
    }
}
