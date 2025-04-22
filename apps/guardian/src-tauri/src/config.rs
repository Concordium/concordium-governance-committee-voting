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
use tauri::api::cli;
use tonic::transport::{ClientTlsConfig, Endpoint};

use crate::shared::{Error, GenesisHash, DEFAULT_REQUEST_TIMEOUT_MS};

/// The CLI argument to specify to override the node used internally.
pub const CLI_ARG_NODE: &str = "node";

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
    pub async fn try_create_from_env(endpoint: v2::Endpoint) -> Result<Self, Error> {
        let timeout = option_env!("CCD_ELECTION_REQUEST_TIMEOUT_MS")
            .map(|v| u64::from_str(v).expect("Could not parse CCD_ELECTION_REQUEST_TIMEOUT_MS"))
            .unwrap_or(DEFAULT_REQUEST_TIMEOUT_MS.into());
        let contract_address = ContractAddress::from_str(env!("CCD_ELECTION_CONTRACT_ADDRESS"))
            .expect("Could not parse CCD_ELECTION_CONTRACT_ADDRESS");
        let network_id = env!("CCD_ELECTION_NETWORK");

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
        let expected_genesis_hash = network_id
            .parse::<Network>()
            .context("CCD_ELECTION_NETWORK needs to be either 'testnet' or 'mainnet'")?
            .genesis_hash();
        if genesis_hash != expected_genesis_hash {
            return Err(anyhow!(
                "Invalid node specified. Application must use a {} node",
                network_id
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
    /// The connection to the contract. Best to access this through
    /// [`AppConfig::connection`] as this lazily creates the connection and
    /// caches it.
    pub connection:     Option<ConnectionConfig>,
    /// The election config registered in the contract. Best to access this
    /// through [`AppConfig::election`] as this lazily loads the
    /// election config and caches it.
    pub election:       Option<ElectionConfig>,
    /// The election guard config. Best to access this through
    /// [`AppConfig::election_guard`] as this lazily loads the
    /// election guard config and caches it.
    pub election_guard: Option<ElectionGuardConfig>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let node_endpoint = Endpoint::from_str(env!("CCD_ELECTION_NODE"))
            .expect("Could not parse CCD_ELECTION_NODE");
        Self {
            node_endpoint,
            connection: Default::default(),
            election: Default::default(),
            election_guard: Default::default(),
        }
    }
}

impl TryFrom<cli::Matches> for AppConfig {
    type Error = Error;

    fn try_from(matches: cli::Matches) -> Result<Self, Self::Error> {
        let Some(serde_json::Value::String(node_arg)) = matches.args.get(CLI_ARG_NODE).map(|node_arg| &node_arg.value) else {
            return Ok(Self::default());
        };

        let node_endpoint = v2::Endpoint::from_str(node_arg)?;
        Ok(Self::create(node_endpoint))
    }
}

impl AppConfig {
    /// Creates a new [`AppConfig`]
    pub fn create(node_endpoint: v2::Endpoint) -> Self {
        Self {
            node_endpoint,
            connection: Default::default(),
            election: Default::default(),
            election_guard: Default::default(),
        }
    }

    /// Gets the connection. If a connection does not exist, a new one is
    /// created and stored in the configuration before being returned.
    pub async fn connection(&mut self) -> Result<ConnectionConfig, Error> {
        let connection = if let Some(connection) = &self.connection {
            connection.clone()
        } else {
            let connection =
                ConnectionConfig::try_create_from_env(self.node_endpoint.clone()).await?;
            self.connection = Some(connection.clone());
            connection
        };

        Ok(connection)
    }

    /// Gets the election guard config. If not already present, it is fetched
    /// and stored (along with the election config) before being returned.
    pub async fn election_guard(&mut self) -> Result<ElectionGuardConfig, Error> {
        let eg = if let Some(eg) = &self.election_guard {
            eg.clone()
        } else {
            let mut connection = self.connection().await?;
            let (election, eg) = connection.try_get_election_config().await?;

            self.election_guard = Some(eg.clone());
            self.election = Some(election);

            eg
        };

        Ok(eg)
    }

    /// Gets the election guard. If not already present, it is fetched and
    /// stored (along with the election guard config) before being returned.
    pub async fn election(&mut self) -> Result<ElectionConfig, Error> {
        let election = if let Some(election) = &self.election {
            election.clone()
        } else {
            let mut connection = self.connection().await?;
            let (election, eg) = connection.try_get_election_config().await?;

            self.election_guard = Some(eg);
            self.election = Some(election.clone());

            election
        };

        Ok(election)
    }
}
