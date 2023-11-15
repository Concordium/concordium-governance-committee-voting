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
    pub url: String,
    /// The hash of the list of voters accessible at `url`.
    pub hash: EligibleVotersHash,
}

/// Representation of a candidate that voters can vote for.
// TODO: what do we need to represent a candidate? Is it even feasible to store any data, or do we
// also want to represent this in a derived and verifiable manner and store the actual list on the
// corresponding election server?
#[derive(Serialize, SchemaType, Clone)]
pub struct Candidate {
    /// The name of the candidate.
    pub name: String,
}

pub type CandidateWeightedVotes = u64;
/// A list of weighted votes, where the position in the list identifies the corresponding
/// [`Candidate`] in the list of candidates
pub type ElectionResult = Vec<CandidateWeightedVotes>;

/// The configuration of the contract
#[derive(Serialize, SchemaType)]
pub struct Config {
    /// The account used to perform administrative functions, such as publishing the final result
    /// of the election.
    pub admin_account: AccountAddress,
    /// A list of candidates - identified by their position in the list - that voters can vote for in the election.
    pub candidates: Vec<Candidate>,
    /// A unique list of guardian accounts used for the election.
    pub guardians: HashSet<AccountAddress>,
    /// The list of eligible voters, represented by a url and a hash of the list.
    pub eligible_voters: EligibleVoters,
    /// A description of the election, e.g. "Concordium GC election, June 2024".
    pub election_description: String,
    /// The start time of the election, marking the time from which votes can be registered.
    pub election_start: Timestamp,
    /// The end time of the election, marking the time at which votes can no longer be registered.
    pub election_end: Timestamp,
}

/// The internal state of the contract
#[derive(Serial, DeserialWithState)]
#[concordium(state_parameter = "S")]
pub struct State<S: HasStateApi = StateApi> {
    pub config: StateBox<Config, S>,
    /// The election result, which will be registered after `election_end` has passed.
    pub election_result: StateBox<Option<ElectionResult>, S>,
}

/// Describes errors that can happen during the execution of the contract.
#[derive(Debug, PartialEq, Eq, Reject, Serialize, SchemaType)]
pub enum Error {
    /// Failed parsing the parameter.
    #[from(ParseError)]
    ParseParams,
    /// Duplicate candidate found when constructing unique list of candidates.
    DuplicateCandidate,
    /// Tried to invoke contract from an unauthorized address.
    Unauthorized,
    /// Election result does not consist of the expected elements
    MalformedElectionResult,
    /// Election is not over
    Inconclusive,
}

/// Parameter supplied to [`init`].
#[derive(Serialize, SchemaType)]
pub struct InitParameter {
    /// The account used to perform administrative functions, such as publishing the final result
    /// of the election. If this is `None`, the account used to instantiate the contract will be
    /// used.
    pub admin_account: Option<AccountAddress>,
    /// A list of candidates that voters can vote for in the election.
    pub candidates: Vec<Candidate>,
    /// The list of guardians for the election.
    pub guardians: Vec<AccountAddress>,
    /// The merkle root of the list of eligible voters and their respective voting weights.
    pub eligible_voters: EligibleVoters,
    /// A description of the election, e.g. "Concordium GC election, June 2024".
    pub election_description: String,
    /// The start time of the election, marking the time from which votes can be registered.
    pub election_start: Timestamp,
    /// The end time of the election, marking the time at which votes can no longer be registered.
    pub election_end: Timestamp,
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
        };
        let state = State {
            config: state_builder.new_box(config),
            election_result: state_builder.new_box(None),
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

/// Temporary until election guard has an encrypted ballot.
#[derive(Serialize, SchemaType)]
pub struct Vote {
    pub candidate_index: u8,
    pub has_vote: bool,
}

/// Temporary until election guard implements an encrypted version of this.
pub type Ballot = Vec<Vote>;

/// The parameter supplied to the [`register_votes`] entrypoint.
pub type RegisterVoteParameter = Ballot;

/// Receive votes registration from voter. If a contract submits the vote, an error is returned.
/// This function does not actually store anything. Instead the encrypted votes should be read by
/// traversing the transactions sent to the contract. 
#[receive(
    contract = "concordium_governance_committee_election",
    name = "registerVotes",
    parameter = "RegisterVoteParameter",
    error = "Error",
)]
fn register_votes(ctx: &ReceiveContext, _host: &Host<State>) -> Result<(), Error> {
    if ctx.sender().is_contract() {
        return Err(Error::Unauthorized);
    };
    Ok(())
}

/// The parameter supplied to the [`post_result`] entrypoint.
pub type PostResultParameter = ElectionResult;

/// Receive the election result and update the contract state with the supplied result from the
/// parameter
#[receive(
    contract = "concordium_governance_committee_election",
    name = "postResult",
    parameter = "PostResultParameter",
    error = "Error",
    mutable
)]
fn post_result(ctx: &ReceiveContext, host: &mut Host<State>) -> Result<(), Error> {
    let parameter: PostResultParameter = ctx.parameter_cursor().get()?;

    let Address::Account(sender) = ctx.sender() else {
        return Err(Error::Unauthorized);
    };
    ensure!(
        sender == host.state.config.admin_account,
        Error::Unauthorized
    );

    let candidates = &host.state.config.candidates;
    ensure!(
        parameter.len() == candidates.len(),
        Error::MalformedElectionResult
    );

    host.state.election_result.update(|_| Some(parameter));
    Ok(())
}

/// The type returned by the [`config`] entrypoint.
pub type ConfigQueryResponse = Config;

/// View function that returns the contract configuration
#[receive(
    contract = "concordium_governance_committee_election",
    name = "config",
    return_value = "ConfigQueryResponse"
)]
fn config<'b>(_ctx: &ReceiveContext, host: &'b Host<State>) -> ReceiveResult<&'b ConfigQueryResponse> {
    Ok(host.state().config.get())
}

/// Describes the election result for a single candidate.
#[derive(Serial, SchemaType)]
pub struct CandidateResult {
    pub candidate: Candidate,
    pub cummulative_votes: CandidateWeightedVotes,
}

/// The type returned by the [`result`] entrypoint.
pub type ResultQueryResponse = Vec<CandidateResult>;

/// View function that returns the content of the state.
#[receive(
    contract = "concordium_governance_committee_election",
    name = "result",
    return_value = "ResultQueryResponse",
    error = "Error"
)]
fn result<'b>(_ctx: &ReceiveContext, host: &'b Host<State>) -> Result<ResultQueryResponse, Error> {
    let Some(result) = &host.state.election_result.get() else {
        return Err(Error::Inconclusive);
    };
    let candidates = &host.state.config.candidates;

    let response: Vec<_> = candidates
        .iter()
        .zip(result)
        .map(|(candidate, &cummulative_votes)| CandidateResult {
            candidate: candidate.clone(),
            cummulative_votes,
        })
        .collect();
    Ok(response)
}
