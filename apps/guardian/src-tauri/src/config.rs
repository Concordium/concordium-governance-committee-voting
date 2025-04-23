use std::str::FromStr;

use anyhow::{anyhow, Context};
use concordium_governance_committee_election::ElectionConfig;
use concordium_rust_sdk::{
    contract_client::ContractClient,
    types::ContractAddress,
    v2::{self, BlockIdentifier},
    web3id::did::Network,
};
use eg::{election_manifest::ElectionManifest, election_parameters::ElectionParameters};
use election_common::HttpClient;
use tonic::transport::ClientTlsConfig;

use crate::{
    shared::{Error, GenesisHash, DEFAULT_REQUEST_TIMEOUT_MS},
    user_config::{PartialUserConfig, UserConfig},
};

/// The necessary election guard configuration to construct election guard
/// entities.
#[derive(Clone)]
pub struct ElectionGuardConfig {
    /// The election manifest
    pub manifest:   ElectionManifest,
    /// The election parameters
    pub parameters: ElectionParameters,
}

pub struct ElectionContractMarker;
/// The election contract client
pub type ElectionClient = ContractClient<ElectionContractMarker>;

/// The contract (and correspondingly node) connection configuration.
#[derive(Clone)]
pub struct ConnectionConfig {
    /// The http client to use for remote resources
    pub http:     HttpClient,
    /// The contract client for querying the contract.
    pub contract: ElectionClient,
}

impl ConnectionConfig {
    /// Creates a connection to a concordium node and a contract client. This
    /// function panics if the necessary environment variables are not set.
    pub async fn try_create_from_env(
        endpoint: v2::Endpoint,
        contract_address: ContractAddress,
        network: Network,
    ) -> Result<Self, Error> {
        let timeout = option_env!("CCD_ELECTION_REQUEST_TIMEOUT_MS")
            .map(|v| u64::from_str(v).expect("Could not parse CCD_ELECTION_REQUEST_TIMEOUT_MS"))
            .unwrap_or(DEFAULT_REQUEST_TIMEOUT_MS.into());

        let endpoint = if endpoint
            .uri()
            .scheme()
            .map_or(false, |x| x == &v2::Scheme::HTTPS)
        {
            endpoint
                .tls_config(ClientTlsConfig::new())
                .context("Unable to construct TLS configuration for Concordium API.")?
        } else {
            endpoint
        };

        let http = HttpClient::try_create(timeout)?;
        let timeout = core::time::Duration::from_millis(timeout);
        let endpoint = endpoint.connect_timeout(timeout).timeout(timeout);
        let mut node = v2::Client::new(endpoint).await?;
        let genesis_hash = node.get_consensus_info().await?.genesis_block;
        let expected_genesis_hash = network.genesis_hash();
        if genesis_hash != expected_genesis_hash {
            return Err(anyhow!(
                "Invalid node specified. Application must use a {} node",
                network
            )
            .into());
        }
        let contract = ElectionClient::create(node, contract_address).await?;

        let contract_connection = Self { contract, http };
        Ok(contract_connection)
    }

    /// Gets the election config from the contract and subsequently the election
    /// guard config.
    pub async fn try_get_election_config(
        &mut self,
    ) -> Result<(ElectionConfig, ElectionGuardConfig), Error> {
        let config: ElectionConfig = self
            .contract
            .view::<_, ElectionConfig, Error>("viewConfig", &(), BlockIdentifier::LastFinal)
            .await?;
        let manifest: ElectionManifest = self
            .http
            .get_json_resource_checked(&config.election_manifest)
            .await?;
        let parameters: ElectionParameters = self
            .http
            .get_json_resource_checked(&config.election_parameters)
            .await?;

        let eg_config = ElectionGuardConfig {
            manifest,
            parameters,
        };
        Ok((config, eg_config))
    }
}

/// The application config necessary for the application to function. All fields
/// are optional to allow initializing the application with an "empty" version
/// of this.
#[derive(Clone)]
pub struct AppConfig {
    /// The node endpoint used internally in the application
    pub node_endpoint:  v2::Endpoint,
    /// The connection to the contract.
    pub connection:     ConnectionConfig,
    /// The election config registered in the contract.
    pub election:       ElectionConfig,
    /// The election guard config.
    pub election_guard: ElectionGuardConfig,
}

impl AppConfig {
    /// Creates a new [`AppConfig`] while checking the parameters create a valid
    /// connection to an election contract.
    ///
    /// # Errors
    /// - If the node endpoint is invalid or the connection to the contract
    ///   fails.
    pub async fn create_checked(
        node_endpoint: v2::Endpoint,
        contract_address: ContractAddress,
        network: Network,
    ) -> Result<Self, Error> {
        let mut connection =
            ConnectionConfig::try_create_from_env(node_endpoint.clone(), contract_address, network)
                .await?;
        let (election, election_guard) = connection.try_get_election_config().await?;

        Ok(Self {
            node_endpoint,
            connection,
            election,
            election_guard,
        })
    }

    /// Creates a new [`AppConfig`] from a user config. If the user config is
    /// incomplete, `None` is returned.
    ///
    /// # Errors
    /// - If the node endpoint is invalid or the connection to the contract
    ///   fails.
    pub async fn from_user_config(config: impl Into<UserConfig>) -> Result<Self, Error> {
        let config: UserConfig = config.into();
        let Some(contract) = config.contract else {
            return Err(Error::IncompleteConfiguration("contract".to_string()));
        };

        Self::create_checked(config.node(), contract, config.network).await
    }
}
