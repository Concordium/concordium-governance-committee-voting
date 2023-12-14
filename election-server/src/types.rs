use concordium_governance_committee_election::RegisterVotesParameter;
use concordium_rust_sdk::{
    smart_contracts::common::{self as contracts_common},
    types::hashes::TransactionHash,
};
use serde::Serialize;

/// Describes an election ballot submission
#[derive(Serialize, Debug)]
pub struct BallotSubmission {
    /// The account which submitted the ballot
    pub account:          contracts_common::AccountAddress,
    /// The ballot submitted
    pub ballot:           RegisterVotesParameter,
    /// The transaction hash of the ballot submission
    pub transaction_hash: TransactionHash,
    /// Whether the ballot proof could be verified.
    pub verified:         bool,
}
