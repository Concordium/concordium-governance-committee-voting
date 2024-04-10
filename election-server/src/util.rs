use anyhow::Context;
use concordium_governance_committee_election::ElectionConfig;
use concordium_rust_sdk::{
    contract_client::{ContractClient, ViewError},
    smart_contracts::common as contracts_common,
    types::{hashes::TransactionHash, smart_contracts::InstanceInfo, ContractAddress},
    v2::{self, BlockIdentifier},
};
use eg::ballot::BallotEncrypted;
use serde::Serialize;
use tonic::transport::ClientTlsConfig;

pub const REGISTER_VOTES_RECEIVE: &str = "election.registerVotes";
pub const CONFIG_VIEW: &str = "viewConfig";

/// Describes an election ballot submission
#[derive(Serialize, Debug)]
pub struct BallotSubmission {
    /// The account which submitted the ballot
    pub account:          contracts_common::AccountAddress,
    /// The ballot submitted
    pub ballot:           BallotEncrypted,
    /// The transaction hash of the ballot submission
    pub transaction_hash: TransactionHash,
    /// Whether the ballot proof could be verified.
    pub verified:         bool,
}

/// Describes an election voting weight delegation
#[derive(Serialize, Debug)]
pub struct VotingWeightDelegation {
    /// The delegator account
    pub from_account:     contracts_common::AccountAddress,
    /// The delegatee account
    pub to_account:       contracts_common::AccountAddress,
    /// The transaction hash of the ballot submission
    pub transaction_hash: TransactionHash,
}

pub enum ElectionContractMarker {}
pub type ElectionContract = ContractClient<ElectionContractMarker>;

/// Creates a [`v2::Client`] from the [`v2::Endpoint`], enabling TLS and setting
/// connection and request timeouts
pub async fn create_client(
    endpoint: v2::Endpoint,
    request_timeout: std::time::Duration,
) -> anyhow::Result<v2::Client> {
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
    let endpoint = endpoint
        .connect_timeout(request_timeout)
        .timeout(request_timeout);
    let node = v2::Client::new(endpoint)
        .await
        .context("Could not connect to node.")?;
    Ok(node)
}

/// Verify that the contract instance represented by `contract_address` is an
/// election contract. We check this to avoid failing silently from not indexing
/// any transactions made to the contract due to either listening to
/// transactions made to the wrong contract of a wrong contract entrypoint.
pub async fn verify_contract(
    mut node: v2::Client,
    contract_address: ContractAddress,
) -> anyhow::Result<ElectionContract> {
    let instance_info = node
        .get_instance_info(contract_address, BlockIdentifier::LastFinal)
        .await
        .context("Could not get instance info for election contract")?
        .response;
    let (name, methods) = match instance_info {
        InstanceInfo::V0 { .. } => anyhow::bail!("Expected V1 contract"),
        InstanceInfo::V1 { methods, name, .. } => (name, methods),
    };

    anyhow::ensure!(
        methods.iter().any(|m| m == REGISTER_VOTES_RECEIVE),
        "Expected method with receive name \"{}\" to be available on contract",
        REGISTER_VOTES_RECEIVE
    );

    Ok(ElectionContract::new(node, contract_address, name))
}

/// Gets the [`ElectionConfig`] from the contract.
pub async fn get_election_config(client: &mut ElectionContract) -> anyhow::Result<ElectionConfig> {
    let election_config = client
        .view::<_, ElectionConfig, ViewError>(CONFIG_VIEW, &(), BlockIdentifier::LastFinal)
        .await?;
    Ok(election_config)
}
