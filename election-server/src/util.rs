use anyhow::Context;
use concordium_governance_committee_election::{
    ElectionConfig, GuardiansState, ViewElectionResultQueryResponse,
};
use concordium_rust_sdk::{
    contract_client::ViewError,
    smart_contracts::common as contracts_common,
    types::hashes::TransactionHash,
    v2::{self, BlockIdentifier},
};
use eg::ballot::BallotEncrypted;
use election_common::contract::ElectionClient as ElectionContract;
use serde::Serialize;
use tonic::transport::ClientTlsConfig;

pub const REGISTER_VOTES_RECEIVE: &str = "election.registerVotes";
pub const CONFIG_VIEW: &str = "viewConfig";
pub const GUARDIANS_VIEW: &str = "viewGuardiansState";
pub const RESULT_VIEW: &str = "viewElectionResult";

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

/// Gets the [`ElectionConfig`] from the contract.
pub async fn get_election_config(client: &mut ElectionContract) -> anyhow::Result<ElectionConfig> {
    let election_config = client
        .view::<_, ElectionConfig, ViewError>(CONFIG_VIEW, &(), BlockIdentifier::LastFinal)
        .await?;
    Ok(election_config)
}

/// Gets the [`GuardiansState`] from the contract.
pub async fn get_guardians_state(client: &mut ElectionContract) -> anyhow::Result<GuardiansState> {
    let guardians_state = client
        .view::<_, GuardiansState, ViewError>(GUARDIANS_VIEW, &(), BlockIdentifier::LastFinal)
        .await?;
    Ok(guardians_state)
}

/// Gets the [`ElectionResult`] from the contract.
pub async fn get_election_result(
    client: &mut ElectionContract,
) -> anyhow::Result<ViewElectionResultQueryResponse> {
    let election_result = client
        .view::<_, ViewElectionResultQueryResponse, ViewError>(
            RESULT_VIEW,
            &(),
            BlockIdentifier::LastFinal,
        )
        .await?;
    Ok(election_result)
}
