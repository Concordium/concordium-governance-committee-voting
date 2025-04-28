use anyhow::Context;
use concordium_base::base::ContractAddress;
use concordium_rust_sdk::{
    types::smart_contracts::InstanceInfo, v2::{self, BlockIdentifier}
};
use concordium_rust_sdk::contract_client::ContractClient;

pub struct ElectionContractMarker;
pub type ElectionClient = ContractClient<ElectionContractMarker>;

const REGISTER_VOTES_RECEIVE: &str = "election.registerVotes";

/// Verify that the contract instance represented by `contract_address` is an
/// election contract. We check this to avoid failing silently from not indexing
/// any transactions made to the contract due to either listening to
/// transactions made to the wrong contract of a wrong contract entrypoint.
pub async fn verify_contract(
    mut node: v2::Client,
    contract_address: ContractAddress,
) -> anyhow::Result<ElectionClient> {
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

    Ok(ElectionClient::new(node, contract_address, name))
}
