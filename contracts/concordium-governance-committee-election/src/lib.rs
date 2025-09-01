#![cfg_attr(not(feature = "std"), no_std)]

//! # A Concordium V1 smart contract

pub use concordium_std::HashSha2256;
use concordium_std::*;

/// Represents the list of eligible voters and their corresponding voting
/// weights by a url, and a corresonding hash of the list.
#[derive(Serialize, SchemaType, Clone, Debug, PartialEq)]
pub struct ChecksumUrl {
    /// The url of the data.
    pub url: String,
    /// The hash of the data found at `url`.
    pub hash: HashSha2256,
}

/// The parameters the voting weight calculations are based upon.
#[derive(Serialize, SchemaType, Clone, Debug, PartialEq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize, serde::Deserialize),
    serde(rename_all = "camelCase")
)]
pub struct EligibleVotersParameters {
    /// The block time at which data collection starts
    pub start_time: Timestamp,
    /// The block time at which data collection ends
    pub end_time: Timestamp,
}

/// Contains the voters data and the parameters used to generate the data.
#[derive(Serialize, SchemaType, Clone, Debug, PartialEq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct EligibleVoters {
    /// The parameters used to compute the voters data. This can be used to
    /// verify the data matches the expected output.
    pub parameters: EligibleVotersParameters,
    /// The voters data.
    pub data: ChecksumUrl,
}

#[cfg(feature = "serde")]
impl serde::Serialize for ChecksumUrl {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;

        let mut state = serializer.serialize_struct("ChecksumUrl", 2)?;
        state.serialize_field("url", &self.url)?;
        state.serialize_field("hash", &self.hash.to_string())?;
        state.end()
    }
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
    /// Error when processing entity
    Malformed,
    /// An attempt to perform an action in the incorrect election phase was made
    IncorrectElectionPhase,
    /// An attempt to override a non-overridable state entry was made
    DuplicateEntry,
    /// An attempt to participate in finalization phase after being excluded.
    GuardianExcluded,
}

/// The different status options available for guardians.
#[derive(Serialize, SchemaType, Clone, Debug, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub enum GuardianStatus {
    /// Guardian could not verify public key(s) of the guardians represented by
    /// the supplied account addresses.
    KeyVerificationFailed(Vec<AccountAddress>),
    /// Guardian could not verify encrypted shares of the guardians represented
    /// by the supplied account addresses.
    SharesVerificationFailed(Vec<AccountAddress>),
    /// Guardian has verified the [`GuardianState`] of other guardians is as
    /// expected.
    VerificationSuccessful,
}

/// State associated with each guardian.
#[derive(Serialize, SchemaType, Clone, Debug, PartialEq)]
pub struct GuardianState {
    /// Index of the guardian used for key-sharing. Not modifiable.
    pub index: u32,
    /// The public key of the guardian.
    pub public_key: Option<Vec<u8>>,
    /// The encrypted share of the guardian.
    pub encrypted_share: Option<Vec<u8>>,
    /// The share of the decryption together with the
    /// commitment share of a single guardian for a `DecryptionProof`.
    pub decryption_share: Option<Vec<u8>>,
    /// The response share of a single guardian for a `DecryptionProof`.
    pub decryption_share_proof: Option<Vec<u8>>,
    /// The verification status of the guardian, with regards to verifying the
    /// state of other guardians is as expected.
    pub status: Option<GuardianStatus>,
    /// Whether the guardian has been excluded due to incorrect behaviour.
    pub excluded: bool,
}

impl GuardianState {
    pub fn new(index: u32) -> Self {
        Self {
            index,
            public_key: None,
            encrypted_share: None,
            status: None,
            decryption_share: None,
            decryption_share_proof: None,
            excluded: false,
        }
    }
}

#[derive(Serialize)]
pub struct RegisteredData {
    /// The list of eligible voters
    pub eligible_voters: EligibleVoters,
    /// A url to the location of the election manifest used by election guard.
    pub election_manifest: ChecksumUrl,
    /// A url to the location of the election parameters used by election guard.
    pub election_parameters: ChecksumUrl,
    /// A description of the election, e.g. "Concordium GC election, June 2024".
    pub election_description: String,
}

/// The internal state of the contract
#[derive(Serial, DeserialWithState)]
#[concordium(state_parameter = "S")]
pub struct State<S: HasStateApi = StateApi> {
    /// The account used to perform administrative functions, such as publishing
    /// the final result of the election.
    pub admin_account: StateBox<AccountAddress, S>,
    /// A list of candidates - identified by their position in the list - that
    /// voters can vote for in the election.
    pub candidates: StateSet<ChecksumUrl, S>,
    /// A unique list of guardian accounts used for the election.
    pub guardians: StateMap<AccountAddress, GuardianState, S>,
    /// Data registered upon contract instantiation which is used by off-chain
    /// applications
    pub registered_data: StateBox<RegisteredData, S>,
    /// The start time of the election, marking the time from which votes can be
    /// registered.
    pub election_start: Timestamp,
    /// The end time of the election, marking the time at which votes can no
    /// longer be registered.
    pub election_end: Timestamp,
    /// Guardians must add their [`GuardianState::decryption_share`] before this
    /// timestamp for their shares to be included in the decrypted result.
    pub decryption_deadline: Timestamp,
    /// The string that should be used when delegating a vote.
    pub delegation_string: StateBox<String, S>,
    /// The encrypted tally posted by the operator for convenience of guardians.
    pub encrypted_tally: StateBox<Option<Vec<u8>>, S>,
    /// The election result, which will be registered after `election_end` has
    /// passed.
    pub election_result: StateBox<Option<ElectionResult>, S>,
}

impl State {
    /// Creates new [`Config`] from passed arguments while also checking that
    /// the configuration is sensible.
    #[allow(clippy::too_many_arguments)]
    fn new_checked(
        ctx: &InitContext,
        state_builder: &mut StateBuilder,
        InitParameter {
            admin_account,
            candidates,
            guardians,
            eligible_voters,
            election_manifest,
            election_parameters,
            election_description,
            election_start,
            election_end,
            decryption_deadline,
            delegation_string,
        }: InitParameter,
    ) -> Result<Self, Error> {
        let now = ctx.metadata().block_time();

        ensure!(election_start >= now, Error::Malformed);
        ensure!(election_start < election_end, Error::Malformed);
        ensure!(election_end < decryption_deadline, Error::Malformed);
        ensure!(!election_description.is_empty(), Error::Malformed);
        ensure!(!candidates.is_empty(), Error::Malformed);
        ensure!(!guardians.is_empty(), Error::Malformed);
        ensure!(!eligible_voters.data.url.is_empty(), Error::Malformed);
        ensure!(!delegation_string.is_empty(), Error::Malformed);

        let mut guardians_map = state_builder.new_map();
        for (&guardian_address, index) in guardians.iter().zip(1u32..) {
            if guardians_map
                .insert(guardian_address, GuardianState::new(index))
                .is_some()
            {
                return Err(Error::Malformed);
            }
        }
        let mut candidates_set = state_builder.new_set();
        for c in candidates.iter() {
            if !candidates_set.insert(c.clone()) {
                return Err(Error::Malformed);
            }
        }

        let registered_data = RegisteredData {
            eligible_voters,
            election_description,
            election_manifest,
            election_parameters,
        };

        let config = Self {
            admin_account: state_builder.new_box(admin_account),
            guardians: guardians_map,
            candidates: candidates_set,
            registered_data: state_builder.new_box(registered_data),
            election_start,
            election_end,
            decryption_deadline,
            encrypted_tally: state_builder.new_box(None),
            election_result: state_builder.new_box(None),
            delegation_string: state_builder.new_box(delegation_string),
        };
        Ok(config)
    }
}

/// Parameter supplied to [`init`].
#[derive(Serialize, SchemaType, Debug)]
pub struct InitParameter {
    /// The account used to perform administrative functions, such as publishing
    /// the final result of the election.
    pub admin_account: AccountAddress,
    /// A list of candidates that voters can vote for in the election.
    pub candidates: Vec<ChecksumUrl>,
    /// The list of guardians for the election.
    pub guardians: Vec<AccountAddress>,
    /// The merkle root of the list of eligible voters and their respective
    /// voting weights.
    pub eligible_voters: EligibleVoters,
    /// A url to the location of the election manifest used by election guard.
    pub election_manifest: ChecksumUrl,
    /// A url to the location of the election parameters used by election guard.
    pub election_parameters: ChecksumUrl,
    /// A description of the election, e.g. "Concordium GC election, June 2024".
    pub election_description: String,
    /// The start time of the election, marking the time from which votes can be
    /// registered.
    pub election_start: Timestamp,
    /// The end time of the election, marking the time at which votes can no
    /// longer be registered.
    pub election_end: Timestamp,
    /// Guardians must add their [`GuardianState::decryption_share`] before this
    /// timestamp for their shares to be included in the decrypted result.
    pub decryption_deadline: Timestamp,
    /// A string that should be used when delegating a vote to another account.
    pub delegation_string: String,
}

#[derive(Serialize, SchemaType, Debug, Clone)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct ElectionConfig {
    /// The account used to perform administrative functions, such as publishing
    /// the final result of the election.
    pub admin_account: AccountAddress,
    /// A list of candidates that voters can vote for in the election.
    pub candidates: Vec<ChecksumUrl>,
    /// The list of guardians for the election.
    pub guardian_accounts: Vec<AccountAddress>,
    /// The merkle root of the list of eligible voters and their respective
    /// voting weights.
    pub eligible_voters: EligibleVoters,
    /// A url to the location of the election manifest used by election guard.
    pub election_manifest: ChecksumUrl,
    /// A url to the location of the election parameters used by election guard.
    pub election_parameters: ChecksumUrl,
    /// A description of the election, e.g. "Concordium GC election, June 2024".
    pub election_description: String,
    /// The start time of the election, marking the time from which votes can be
    /// registered.
    pub election_start: Timestamp,
    /// The end time of the election, marking the time at which votes can no
    /// longer be registered.
    pub election_end: Timestamp,
    /// Guardians must add their [`GuardianState::decryption_share`] before this
    /// timestamp for their shares to be included in the decrypted result.
    pub decryption_deadline: Timestamp,
    /// A string that should be used when delegating a vote to another account.
    pub delegation_string: String,
}

impl From<&State> for ElectionConfig {
    fn from(value: &State) -> Self {
        let registered_data = value.registered_data.get();
        let candidates = value.candidates.iter().map(|c| c.clone()).collect();
        let guardian_accounts = value.guardians.iter().map(|(ga, _)| *ga).collect();

        Self {
            admin_account: *value.admin_account.get(),
            election_description: registered_data.election_description.clone(),
            election_start: value.election_start,
            election_end: value.election_end,
            decryption_deadline: value.decryption_deadline,
            eligible_voters: registered_data.eligible_voters.clone(),
            election_manifest: registered_data.election_manifest.clone(),
            election_parameters: registered_data.election_parameters.clone(),
            candidates,
            guardian_accounts,
            delegation_string: value.delegation_string.clone(),
        }
    }
}

/// Init function that creates a new smart contract with an initial [`State`]
/// derived from the supplied [`InitParameter`]
#[init(contract = "election", parameter = "InitParameter", error = "Error")]
fn init(ctx: &InitContext, state_builder: &mut StateBuilder) -> InitResult<State> {
    let parameter: InitParameter = ctx.parameter_cursor().get()?;
    let initial_state = State::new_checked(ctx, state_builder, parameter)?;
    Ok(initial_state)
}

/// Validates the context for guardian state updates. Returns a mutable
/// reference to the [`GuardianState`] corresponding to the sender address from
/// the [`ReceiveContext`].
fn validate_guardian_context<'a>(
    ctx: &ReceiveContext,
    host: &'a mut Host<State>,
) -> Result<StateRefMut<'a, GuardianState, ExternStateApi>, Error> {
    let Address::Account(sender) = ctx.sender() else {
        bail!(Error::Unauthorized);
    };

    host.state
        .guardians
        .get_mut(&sender)
        .ok_or(Error::Unauthorized)
}

/// The parameter expected by the [`register_guardian_pre_key`] entrypoint.
pub type RegisterGuardianPublicKeyParameter = Vec<u8>;

/// Entrypoint for registering a public key for the guardian corresponding to
/// the sender address.
#[receive(
    contract = "election",
    name = "registerGuardianPublicKey",
    parameter = "RegisterGuardianPublicKeyParameter",
    error = "Error",
    mutable
)]
fn register_guardian_public_key(ctx: &ReceiveContext, host: &mut Host<State>) -> Result<(), Error> {
    let now = ctx.metadata().block_time();
    ensure!(
        now < host.state.election_start,
        Error::IncorrectElectionPhase
    );

    let mut guardian_state = validate_guardian_context(ctx, host)?;
    ensure!(guardian_state.public_key.is_none(), Error::DuplicateEntry);

    let parameter: RegisterGuardianPublicKeyParameter = ctx.parameter_cursor().get()?;
    guardian_state.public_key = Some(parameter);
    Ok(())
}

/// The parameter expected by the [`register_guardian_encrypted_share`]
/// entrypoint.
pub type RegisterGuardianEncryptedShareParameter = Vec<u8>;

/// Entrypoint for registering an encryption share for the guardian
/// corresponding to the sender address.
#[receive(
    contract = "election",
    name = "registerGuardianEncryptedShare",
    parameter = "RegisterGuardianEncryptedShareParameter",
    error = "Error",
    mutable
)]
fn register_guardian_encrypted_share(
    ctx: &ReceiveContext,
    host: &mut Host<State>,
) -> Result<(), Error> {
    let now = ctx.metadata().block_time();
    ensure!(
        now < host.state.election_start,
        Error::IncorrectElectionPhase
    );

    let mut guardian_state = validate_guardian_context(ctx, host)?;
    ensure!(
        guardian_state.encrypted_share.is_none(),
        Error::DuplicateEntry
    );

    let parameter: RegisterGuardianEncryptedShareParameter = ctx.parameter_cursor().get()?;
    guardian_state.encrypted_share = Some(parameter);
    Ok(())
}

/// Entrypoint for registering the share of the decryption.
/// The parameter is meant to be Msgpack serialization of the
/// `DecryptionShareResult` type of electionguard.
#[receive(
    contract = "election",
    name = "postDecryptionShare",
    parameter = "Vec<u8>",
    error = "Error",
    mutable
)]
fn post_decryption_share(ctx: &ReceiveContext, host: &mut Host<State>) -> Result<(), Error> {
    let now = ctx.metadata().block_time();
    ensure!(
        host.state.election_end < now && now < host.state.decryption_deadline,
        Error::IncorrectElectionPhase
    );

    let mut guardian_state = validate_guardian_context(ctx, host)?;
    ensure!(!guardian_state.excluded, Error::GuardianExcluded);
    ensure!(
        guardian_state.decryption_share.is_none(),
        Error::DuplicateEntry
    );

    let parameter: Vec<u8> = ctx.parameter_cursor().get()?;
    guardian_state.decryption_share = Some(parameter);
    Ok(())
}

/// Entrypoint for registering the proof that the decryption share is correct.
/// The parameter is meant to be Msgpack serialization of the
/// `DecryptionProofResponseShare` type of electionguard.
#[receive(
    contract = "election",
    name = "postDecryptionProofResponseShare",
    parameter = "Vec<u8>",
    error = "Error",
    mutable
)]
fn post_decryption_proof_response_share(
    ctx: &ReceiveContext,
    host: &mut Host<State>,
) -> Result<(), Error> {
    let now = ctx.metadata().block_time();
    ensure!(host.state.election_end < now, Error::IncorrectElectionPhase);

    let mut guardian_state = validate_guardian_context(ctx, host)?;
    ensure!(!guardian_state.excluded, Error::GuardianExcluded);
    ensure!(
        guardian_state.decryption_share_proof.is_none(),
        Error::DuplicateEntry
    );

    let parameter: Vec<u8> = ctx.parameter_cursor().get()?;
    guardian_state.decryption_share_proof = Some(parameter);
    Ok(())
}

/// Entrypoint for filing a complaint if the cumulative state of guardians
/// cannot be verified.
#[receive(
    contract = "election",
    name = "registerGuardianStatus",
    parameter = "GuardianStatus",
    error = "Error",
    mutable
)]
fn register_guardian_status(ctx: &ReceiveContext, host: &mut Host<State>) -> Result<(), Error> {
    let now = ctx.metadata().block_time();
    ensure!(
        now < host.state.election_start,
        Error::IncorrectElectionPhase
    );

    let mut guardian_state = validate_guardian_context(ctx, host)?;
    ensure!(!guardian_state.excluded, Error::GuardianExcluded);
    ensure!(guardian_state.status.is_none(), Error::DuplicateEntry);

    let status: GuardianStatus = ctx.parameter_cursor().get()?;
    guardian_state.status = Some(status);
    Ok(())
}

/// The cumulative state of all guardians
pub type GuardiansState = Vec<(AccountAddress, GuardianState)>;

/// View the cumulative state of all guardians. This is useful for guardians to
/// validate the key registrations of other guardians, and construct final keys
/// from registered pre-keys.
#[receive(
    contract = "election",
    name = "viewGuardiansState",
    return_value = "GuardiansState"
)]
fn view_guardians_state(
    _ctx: &ReceiveContext,
    host: &Host<State>,
) -> ReceiveResult<GuardiansState> {
    let guardians_state = &host.state.guardians;
    let guardians_state: Vec<_> = guardians_state
        .iter()
        .map(|(address, guardian_state)| (*address, guardian_state.clone()))
        .collect();
    Ok(guardians_state)
}

/// The parameter supplied to the [`register_votes`] entrypoint.
#[derive(Serialize)]
#[repr(transparent)]
pub struct RegisterVotesParameter {
    pub inner: Vec<u8>,
}

impl From<Vec<u8>> for RegisterVotesParameter {
    fn from(value: Vec<u8>) -> Self {
        Self { inner: value }
    }
}

impl schema::SchemaType for RegisterVotesParameter {
    fn get_type() -> schema::Type {
        schema::Type::ByteList(schema::SizeLength::U32)
    }
}

/// Receive votes registration from voter. If a contract submits the vote, an
/// error is returned. This function does not actually store anything. Instead
/// the encrypted votes should be read by traversing the transactions sent to
/// the contract.
#[receive(
    contract = "election",
    name = "registerVotes",
    parameter = "RegisterVotesParameter",
    error = "Error"
)]
fn register_votes(ctx: &ReceiveContext, host: &Host<State>) -> Result<(), Error> {
    ensure!(ctx.sender().is_account(), Error::Unauthorized);

    let now = ctx.metadata().block_time();
    ensure!(
        host.state.election_start <= now && now <= host.state.election_end,
        Error::IncorrectElectionPhase
    );

    Ok(())
}

/// The parameter supplied to the [`post_encrypted_tally`] entrypoint.
pub type PostEncryptedTallyParameter = Vec<u8>;

/// Receive the election result and update the contract state with the supplied
/// result from the parameter
#[receive(
    contract = "election",
    name = "postEncryptedTally",
    parameter = "PostEncryptedTallyParameter",
    error = "Error",
    mutable
)]
fn post_encrypted_tally(ctx: &ReceiveContext, host: &mut Host<State>) -> Result<(), Error> {
    let now = ctx.metadata().block_time();

    ensure!(
        ctx.sender().matches_account(host.state.admin_account.get()),
        Error::Unauthorized
    );
    ensure!(now > host.state.election_end, Error::IncorrectElectionPhase);

    let parameter: PostEncryptedTallyParameter = ctx.parameter_cursor().get()?;

    *host.state.encrypted_tally.get_mut() = Some(parameter);
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

    ensure!(
        ctx.sender().matches_account(host.state.admin_account.get()),
        Error::Unauthorized
    );
    ensure!(now > host.state.election_end, Error::IncorrectElectionPhase);

    let candidates: Vec<_> = host.state.candidates.iter().collect();
    let parameter: PostResultParameter = ctx.parameter_cursor().get()?;
    ensure!(parameter.len() == candidates.len(), Error::Malformed);
    *host.state.election_result.get_mut() = Some(parameter);
    Ok(())
}

/// The parameter supplied to the [`reset_finalization_phase`] entrypoint.
pub type ResetFinalizationParameter = (Vec<AccountAddress>, Timestamp);

#[receive(
    contract = "election",
    name = "resetFinalizationPhase",
    parameter = "ResetFinalizationParameter",
    error = "Error",
    mutable
)]
fn reset_finalization_phase(ctx: &ReceiveContext, host: &mut Host<State>) -> Result<(), Error> {
    let now = ctx.metadata().block_time();

    ensure!(
        ctx.sender().matches_account(host.state.admin_account.get()),
        Error::Unauthorized
    );
    ensure!(now > host.state.election_end, Error::IncorrectElectionPhase);

    let (to_exclude, deadline): ResetFinalizationParameter = ctx.parameter_cursor().get()?;

    ensure!(now < deadline, Error::Malformed);
    host.state.decryption_deadline = deadline;

    for (account, mut guardian_state) in host.state.guardians.iter_mut() {
        if to_exclude.contains(&account) {
            guardian_state.excluded = true;
        }
        guardian_state.decryption_share = None;
        guardian_state.decryption_share_proof = None;
    }

    Ok(())
}

/// View function that returns the contract configuration
#[receive(
    contract = "election",
    name = "viewConfig",
    return_value = "ElectionConfig"
)]
fn view_config(_ctx: &ReceiveContext, host: &Host<State>) -> ReceiveResult<ElectionConfig> {
    Ok(host.state().into())
}

/// Describes the election result for a single candidate.
#[derive(Serialize, SchemaType, Debug, PartialEq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
pub struct CandidateResult {
    pub candidate: ChecksumUrl,
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
fn view_election_result(
    _ctx: &ReceiveContext,
    host: &Host<State>,
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

/// View function that returns the encrypted tally.
#[receive(
    contract = "election",
    name = "viewEncryptedTally",
    return_value = "Option<Vec<u8>>",
    error = "Error"
)]
fn view_encrypted_tally(
    _ctx: &ReceiveContext,
    host: &Host<State>,
) -> ReceiveResult<Option<Vec<u8>>> {
    if let Some(result) = &host.state.encrypted_tally.get() {
        Ok(Some(result.clone()))
    } else {
        Ok(None)
    }
}
