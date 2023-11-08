#![cfg_attr(not(feature = "std"), no_std)]

//! # A Concordium V1 smart contract
use concordium_std::*;
use core::fmt::Debug;

/// Your smart contract state.
#[derive(Serialize, SchemaType)]
pub struct State {
    /// The account used to perform administrative functions, such as publishing the final result
    /// of the election.
    admin_account: AccountAddress,
    /// A list of candidates that voters can vote for in the election
    candidates: Vec<Candidate>,
    /// The merkle root of the list of eligible voters and their respective voting weights.
    eligible_voter_weights: EligibleVotersHash,
    /// A description of the election, e.g. "Concordium GC election, June 2024"
    election_description: String,
    /// The start time of the election, marking the time from which votes can be registered.
    election_start: Timestamp,
    /// The end time of the election, marking the time at which votes can no longer be registered.
    election_end: Timestamp,
}

/// Your smart contract errors.
#[derive(Debug, PartialEq, Eq, Reject, Serialize, SchemaType)]
pub enum Error {
    /// Failed parsing the parameter.
    #[from(ParseError)]
    ParseParams,
    /// Your error
    YourError,
}

/// Representation of a candidate that voters can vote for.
// TODO: what do we need to represent a candidate? Is it even feasible to store any data, or do we
// also want to represent this in a derived and verifiable manner and store the actual list on the
// corresponding election server?
#[derive(Serialize, SchemaType)]
pub struct Candidate {
    /// The name of the candidate.
    name: String,
}

/// The concrete hash type used to represent the list of eligible voters and their respective
/// weights. This will be calculated by representing the list of voters as a merkle tree.
pub type EligibleVotersHash = HashSha3256; // TODO: Is this the correct hashing algorithm?

/// Parameter supplied to `init`.
#[derive(Serialize, SchemaType)]
pub struct InitParameter {
    /// The account used to perform administrative functions, such as publishing the final result
    /// of the election. If this is `None`, the account used to instantiate the contract will be
    /// used.
    admin_account: Option<AccountAddress>,
    /// A list of candidates that voters can vote for in the election
    candidates: Vec<Candidate>,
    /// The merkle root of the list of eligible voters and their respective voting weights.
    eligible_voter_weights: EligibleVotersHash,
    /// A description of the election, e.g. "Concordium GC election, June 2024"
    election_description: String,
    /// The start time of the election, marking the time from which votes can be registered.
    election_start: Timestamp,
    /// The end time of the election, marking the time at which votes can no longer be registered.
    election_end: Timestamp,
}

impl InitParameter {
    /// Converts the init parameter to [`State`] with a supplied function for getting a fallback
    /// admin account if none is specified. The function consumes the parameter in the process.
    fn into_state<F>(self, get_fallback_admin: F) -> State
    where
        F: FnOnce() -> AccountAddress,
    {
        let admin_account = self.admin_account.unwrap_or_else(get_fallback_admin);
        return State {
            admin_account,
            candidates: self.candidates,
            election_description: self.election_description,
            eligible_voter_weights: self.eligible_voter_weights,
            election_start: self.election_start,
            election_end: self.election_end,
        };
    }
}

/// Init function that creates a new smart contract.
#[init(
    contract = "concordium_governance_committee_election",
    parameter = "InitParameter"
)]
fn init(ctx: &InitContext, _state_builder: &mut StateBuilder) -> InitResult<State> {
    let parameter: InitParameter = ctx.parameter_cursor().get()?;
    let initial_state = parameter.into_state(|| ctx.init_origin());
    Ok(initial_state)
}

pub type MyInputType = bool;

/// Receive function. The input parameter is the boolean variable `throw_error`.
///  If `throw_error == true`, the receive function will throw a custom error.
///  If `throw_error == false`, the receive function executes successfully.
#[receive(
    contract = "concordium_governance_committee_election",
    name = "receive",
    parameter = "MyInputType",
    error = "Error",
    mutable
)]
fn receive(ctx: &ReceiveContext, _host: &mut Host<State>) -> Result<(), Error> {
    // Your code

    let throw_error = ctx.parameter_cursor().get()?; // Returns Error::ParseError on failure
    if throw_error {
        Err(Error::YourError)
    } else {
        Ok(())
    }
}

/// View function that returns the content of the state.
#[receive(
    contract = "concordium_governance_committee_election",
    name = "view",
    return_value = "State"
)]
fn view<'b>(_ctx: &ReceiveContext, host: &'b Host<State>) -> ReceiveResult<&'b State> {
    Ok(host.state())
}
