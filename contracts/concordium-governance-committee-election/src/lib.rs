#![cfg_attr(not(feature = "std"), no_std)]

//! # A Concordium V1 smart contract

use concordium_std::*;

/// The concrete hash type used to represent the list of eligible voters and their respective
/// weights.
pub type EligibleVotersHash = HashSha3256; // TODO: Is this the correct hashing algorithm?

/// Represents the list of eligible voters and their corresponding voting weights by a url,
/// and a corresonding hash of the list.
#[derive(Serialize, SchemaType, Clone)]
pub struct EligibleVoters {
    /// The url where the list of voters can be found.
    url: String,
    /// The hash of the list of voters accessible at `url`.
    hash: EligibleVotersHash,
}

/// Representation of a candidate that voters can vote for.
// TODO: what do we need to represent a candidate? Is it even feasible to store any data, or do we
// also want to represent this in a derived and verifiable manner and store the actual list on the
// corresponding election server?
#[derive(Serialize, SchemaType, Clone)]
pub struct Candidate {
    /// The name of the candidate.
    name: String,
}

pub type CandidateWeightedVotes = u64;
/// A list of weighted votes, where the position in the list identifies the corresponding
/// [`Candidate`] in the list of candidates
pub type ElectionResult = Vec<CandidateWeightedVotes>;

/// Your smart contract state.
#[derive(Serialize, SchemaType)]
pub struct Config {
    /// The account used to perform administrative functions, such as publishing the final result
    /// of the election.
    admin_account: AccountAddress,
    /// A list of candidates - identified by their position in the list - that voters can vote for in the election.
    // TODO: I kind of wanted to do a StateSet here, but I don't know what to identify the each candidate by?
    candidates: Vec<Candidate>,
    /// A unique list of guardian accounts used for the election.
    guardians: HashSet<AccountAddress>,
    /// The list of eligible voters, represented by a url and a hash of the list.
    eligible_voters: EligibleVoters,
    /// A description of the election, e.g. "Concordium GC election, June 2024".
    election_description: String,
    /// The start time of the election, marking the time from which votes can be registered.
    election_start: Timestamp,
    /// The end time of the election, marking the time at which votes can no longer be registered.
    election_end: Timestamp,
    /// The election result, which will be registered after `election_end` has passed.
    election_result: Option<Vec<CandidateWeightedVotes>>,
}

#[derive(Serial, DeserialWithState)]
#[concordium(state_parameter = "S")]
pub struct State<S: HasStateApi = StateApi> {
    config: StateBox<Config, S>,
}

/// Your smart contract errors.
#[derive(Debug, PartialEq, Eq, Reject, Serialize, SchemaType)]
pub enum Error {
    /// Failed parsing the parameter.
    #[from(ParseError)]
    ParseParams,
    /// Duplicate candidate found when constructing unique list of candidates.
    DuplicateCandidate,
    YourError, // TODO: remove
}

/// Parameter supplied to `init`.
#[derive(Serialize, SchemaType)]
pub struct InitParameter {
    /// The account used to perform administrative functions, such as publishing the final result
    /// of the election. If this is `None`, the account used to instantiate the contract will be
    /// used.
    admin_account: Option<AccountAddress>,
    /// A list of candidates that voters can vote for in the election.
    candidates: Vec<Candidate>,
    /// The list of guardians for the election.
    guardians: Vec<AccountAddress>,
    /// The merkle root of the list of eligible voters and their respective voting weights.
    eligible_voters: EligibleVoters,
    /// A description of the election, e.g. "Concordium GC election, June 2024".
    election_description: String,
    /// The start time of the election, marking the time from which votes can be registered.
    election_start: Timestamp,
    /// The end time of the election, marking the time at which votes can no longer be registered.
    election_end: Timestamp,
}

impl InitParameter {
    /// Converts the init parameter to [`State`] with a supplied function for getting a fallback
    /// admin account if none is specified. The function consumes the parameter in the process.
    fn into_state<F>(
        self,
        state_builder: &mut StateBuilder,
        get_fallback_admin: F,
    ) -> Result<State, Error>
    where
        F: FnOnce() -> AccountAddress,
    {
        let admin_account = self.admin_account.unwrap_or_else(get_fallback_admin);
        let config = Config {
            admin_account,
            candidates: self.candidates,
            guardians: HashSet::from_iter(self.guardians.into_iter()),
            election_description: self.election_description,
            eligible_voters: self.eligible_voters,
            election_start: self.election_start,
            election_end: self.election_end,
            election_result: None,
        };
        let state = State {
            config: state_builder.new_box(config),
        };
        Ok(state)
    }
}

/// Init function that creates a new smart contract with an initial [`State`] derived from the supplied [`InitParameter`]
#[init(
    contract = "concordium_governance_committee_election",
    parameter = "InitParameter",
    error = "Error"
)]
fn init(ctx: &InitContext, state_builder: &mut StateBuilder) -> InitResult<State> {
    let parameter: InitParameter = ctx.parameter_cursor().get()?;
    let initial_state = parameter.into_state(state_builder, || ctx.init_origin())?;
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
    return_value = "ViewQueryResponse"
)]
fn view<'b>(_ctx: &ReceiveContext, host: &'b Host<State>) -> ReceiveResult<&'b State> {
    Ok(host.state())
}
