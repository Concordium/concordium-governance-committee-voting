#![cfg_attr(not(feature = "std"), no_std)]

//! # A Concordium V1 smart contract

use concordium_std::*;

/// Represents the list of eligible voters and their corresponding voting
/// weights by a url, and a corresonding hash of the list.
#[derive(Serialize, SchemaType, Clone, Debug, PartialEq)]
pub struct ChecksumUrl {
    /// The url of the data.
    pub url:  String,
    /// The hash of the data found at `url`.
    pub hash: HashSha2256,
}

/// An amount of weighted votes for a candidate
pub type CandidateWeightedVotes = u64;

/// A list of weighted votes, where the position in the list identifies the
/// corresponding [`ChecksumUrl`] in the list of candidates
pub type ElectionResult = Vec<CandidateWeightedVotes>;

/// Describes errors that can happen during the execution of the contract.
#[derive(Debug, PartialEq, Eq, Reject, Serialize, SchemaType)]
pub enum Error {
    /// Failed parsing the parameter.
    #[from(ParseError)]
    ParseParams,
    /// Tried to invoke contract from an unauthorized address.
    Unauthorized,
    /// Could not create [`Config`] struct.
    MalformedConfig,
    /// Election result does not consist of the expected elements
    MalformedElectionResult,
    /// Election is closed
    ElectionClosed,
    /// Election is not over
    Inconclusive,
}

/// State associated with each guardian.
#[derive(Serialize, SchemaType)]
pub struct GuardianState;

/// The internal state of the contract
#[derive(Serial, DeserialWithState)]
#[concordium(state_parameter = "S")]
pub struct State<S: HasStateApi = StateApi> {
    /// The account used to perform administrative functions, such as publishing
    /// the final result of the election.
    pub admin_account:        StateBox<AccountAddress, S>,
    /// A list of candidates - identified by their position in the list - that
    /// voters can vote for in the election.
    pub candidates:           StateSet<ChecksumUrl, S>,
    /// A unique list of guardian accounts used for the election.
    pub guardians:            StateMap<AccountAddress, GuardianState, S>,
    /// The list of eligible voters, represented by a url and a hash of the
    /// list.
    pub eligible_voters:      StateBox<ChecksumUrl, S>,
    /// A description of the election, e.g. "Concordium GC election, June 2024".
    pub election_description: StateBox<String, S>,
    /// The start time of the election, marking the time from which votes can be
    /// registered.
    pub election_start:       Timestamp,
    /// The end time of the election, marking the time at which votes can no
    /// longer be registered.
    pub election_end:         Timestamp,
    /// The election result, which will be registered after `election_end` has
    /// passed.
    pub election_result:      StateBox<Option<ElectionResult>, S>,
}

impl State {
    /// Creates new [`Config`] from passed arguments while also checking that
    /// the configuration is sensible.
    fn new_checked(
        ctx: &InitContext,
        state_builder: &mut StateBuilder,
        admin_account: AccountAddress,
        candidates: Vec<ChecksumUrl>,
        guardians: Vec<AccountAddress>,
        eligible_voters: ChecksumUrl,
        election_description: String,
        election_start: Timestamp,
        election_end: Timestamp,
    ) -> Result<Self, Error> {
        let now = ctx.metadata().block_time();

        ensure!(election_start > now, Error::MalformedConfig);
        ensure!(election_start < election_end, Error::MalformedConfig);
        ensure!(!election_description.is_empty(), Error::MalformedConfig);
        ensure!(!candidates.is_empty(), Error::MalformedConfig);
        ensure!(!guardians.is_empty(), Error::MalformedConfig);
        ensure!(!eligible_voters.url.is_empty(), Error::MalformedConfig);

        let mut guardians_map = state_builder.new_map();
        for g in guardians.iter() {
            if guardians_map.insert(*g, GuardianState).is_some() {
                return Err(Error::MalformedConfig);
            }
        }
        let mut candidates_set = state_builder.new_set();
        for c in candidates.iter() {
            if !candidates_set.insert(c.clone()) {
                return Err(Error::MalformedConfig);
            }
        }

        let config = Self {
            admin_account: state_builder.new_box(admin_account),
            candidates: candidates_set,
            guardians: guardians_map,
            eligible_voters: state_builder.new_box(eligible_voters),
            election_description: state_builder.new_box(election_description),
            election_start,
            election_end,
            election_result: state_builder.new_box(None),
        };
        Ok(config)
    }
}

/// Parameter supplied to [`init`].
#[derive(Serialize, SchemaType, Debug)]
pub struct ElectionConfig {
    /// The account used to perform administrative functions, such as publishing
    /// the final result of the election.
    pub admin_account:        AccountAddress,
    /// A list of candidates that voters can vote for in the election.
    pub candidates:           Vec<ChecksumUrl>,
    /// The list of guardians for the election.
    pub guardians:            Vec<AccountAddress>,
    /// The merkle root of the list of eligible voters and their respective
    /// voting weights.
    pub eligible_voters:      ChecksumUrl,
    /// A description of the election, e.g. "Concordium GC election, June 2024".
    pub election_description: String,
    /// The start time of the election, marking the time from which votes can be
    /// registered.
    pub election_start:       Timestamp,
    /// The end time of the election, marking the time at which votes can no
    /// longer be registered.
    pub election_end:         Timestamp,
}

impl ElectionConfig {
    /// Converts the init parameter to [`State`] with a supplied function for
    /// getting a fallback admin account if none is specified. The function
    /// consumes the parameter in the process.
    fn into_state(
        self,
        ctx: &InitContext,
        state_builder: &mut StateBuilder,
    ) -> Result<State, Error> {
        let state = State::new_checked(
            ctx,
            state_builder,
            self.admin_account,
            self.candidates,
            self.guardians,
            self.eligible_voters,
            self.election_description,
            self.election_start,
            self.election_end,
        )?;
        Ok(state)
    }
}

impl From<&State> for ElectionConfig {
    fn from(value: &State) -> Self {
        Self {
            admin_account:        *value.admin_account.get(),
            election_description: value.election_description.get().clone(),
            election_start:       value.election_start,
            election_end:         value.election_end,
            eligible_voters:      value.eligible_voters.get().clone(),
            candidates:           value.candidates.iter().map(|c| c.clone()).collect(),
            // FIXME: Ignores associated `GuardianState` until we know more..
            guardians:            value.guardians.iter().map(|(ga, _)| *ga).collect(),
        }
    }
}

/// Init function that creates a new smart contract with an initial [`State`]
/// derived from the supplied [`InitParameter`]
#[init(contract = "election", parameter = "ElectionConfig", error = "Error")]
fn init(ctx: &InitContext, state_builder: &mut StateBuilder) -> InitResult<State> {
    let parameter: ElectionConfig = ctx.parameter_cursor().get()?;
    let initial_state = parameter.into_state(ctx, state_builder)?;
    Ok(initial_state)
}

/// Temporary until election guard has an encrypted ballot.
#[derive(Serialize, SchemaType, Debug)]
#[cfg_attr(feature = "full", derive(serde::Serialize, serde::Deserialize, Clone, Copy))]
pub struct Vote {
    pub candidate_index: u8,
    pub has_vote:        bool,
}

/// The parameter supplied to the [`register_votes`] entrypoint.
pub type RegisterVotesParameter = Vec<Vote>;

/// Receive votes registration from voter. If a contract submits the vote, an
/// error is returned. This function does not actually store anything. Instead
/// the encrypted votes should be read by traversing the transactions sent to
/// the contract.
#[receive(
    contract = "election",
    name = "registerVotes",
    parameter = "RegisterVoteParameter",
    error = "Error"
)]
fn register_votes(ctx: &ReceiveContext, host: &Host<State>) -> Result<(), Error> {
    let now = ctx.metadata().block_time();

    ensure!(ctx.sender().is_account(), Error::Unauthorized);
    ensure!(
        host.state.election_start <= now && now <= host.state.election_end,
        Error::ElectionClosed
    );

    Ok(())
}

/// The parameter supplied to the [`post_election_result`] entrypoint.
pub type PostResultParameter = Vec<CandidateWeightedVotes>;

/// Receive the election result and update the contract state with the supplied
/// result from the parameter
#[receive(
    contract = "election",
    name = "postElectionResult",
    parameter = "PostResultParameter",
    error = "Error",
    mutable
)]
fn post_election_result(ctx: &ReceiveContext, host: &mut Host<State>) -> Result<(), Error> {
    let now = ctx.metadata().block_time();

    let Address::Account(sender) = ctx.sender() else {
        return Err(Error::Unauthorized);
    };
    ensure!(
        &sender == host.state.admin_account.get(),
        Error::Unauthorized
    );
    ensure!(now > host.state.election_end, Error::Inconclusive);

    let candidates: Vec<_> = host.state.candidates.iter().collect();
    let parameter: PostResultParameter = ctx.parameter_cursor().get()?;
    ensure!(
        parameter.len() == candidates.len(),
        Error::MalformedElectionResult
    );

    *host.state.election_result.get_mut() = Some(parameter);
    Ok(())
}

/// View function that returns the contract configuration
#[receive(
    contract = "election",
    name = "viewConfig",
    return_value = "ElectionConfig"
)]
fn view_config<'b>(_ctx: &ReceiveContext, host: &'b Host<State>) -> ReceiveResult<ElectionConfig> {
    Ok(host.state().into())
}

/// Describes the election result for a single candidate.
#[derive(Serialize, SchemaType, Debug, PartialEq)]
pub struct CandidateResult {
    pub candidate:         ChecksumUrl,
    pub cummulative_votes: CandidateWeightedVotes,
}

/// The type returned by the [`result`] entrypoint.
pub type ViewElectionResultQueryResponse = Option<Vec<CandidateResult>>;

/// View function that returns the content of the state.
#[receive(
    contract = "election",
    name = "viewElectionResult",
    return_value = "ViewElectionResultQueryResponse",
    error = "Error"
)]
fn view_election_result<'b>(
    _ctx: &ReceiveContext,
    host: &'b Host<State>,
) -> ReceiveResult<ViewElectionResultQueryResponse> {
    let Some(result) = &host.state.election_result.get() else {
        return Ok(None);
    };

    let candidates: Vec<_> = host.state.candidates.iter().map(|c| c.clone()).collect();
    let response: Vec<_> = candidates
        .iter()
        .zip(result)
        .map(|(candidate, &cummulative_votes)| CandidateResult {
            candidate: candidate.clone(),
            cummulative_votes,
        })
        .collect();

    Ok(Some(response))
}
