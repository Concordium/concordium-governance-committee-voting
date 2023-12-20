use concordium_governance_committee_election::*;
use concordium_smart_contract_testing::*;
use concordium_std::HashSha2256;

/// A test account.
const ALICE: AccountAddress = AccountAddress([0u8; 32]);
const ALICE_ADDR: Address = Address::Account(ALICE);

const BOB: AccountAddress = AccountAddress([1u8; 32]);
const BOB_ADDR: Address = Address::Account(BOB);

const CAROLINE: AccountAddress = AccountAddress([2u8; 32]);
const CAROLINE_ADDR: Address = Address::Account(CAROLINE);

const DANIEL: AccountAddress = AccountAddress([3u8; 32]);
const DANIEL_ADDR: Address = Address::Account(DANIEL);

/// The initial balance of the ALICE test account.
const ACC_INITIAL_BALANCE: Amount = Amount::from_ccd(10_000);

/// A [`Signer`] with one set of keys, used for signing transactions.
const SIGNER: Signer = Signer::with_one_key();

#[test]
fn test_init_errors() {
    let (mut chain, module_ref) = new_chain_and_module();

    let candidates = vec![
        ChecksumUrl {
            url:  "https://candidates.concordium.com/john".to_string(),
            hash: HashSha2256([0; 32]),
        },
        ChecksumUrl {
            url:  "https://candidates.concordium.com/peter".to_string(),
            hash: HashSha2256([1; 32]),
        },
    ];
    let guardians = vec![BOB, CAROLINE];
    let now = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::seconds(5))
        .unwrap();
    let future_1d = now.clone().checked_add_days(chrono::Days::new(1)).unwrap();
    let election_start = now.try_into().expect("Valid datetime");
    let election_end = future_1d.try_into().expect("Valid datetime");
    let eligible_voters = ChecksumUrl {
        url:  "http://some.election/voters".to_string(),
        hash: HashSha2256([0u8; 32]),
    };
    let election_description = "Test election".to_string();

    let get_init_param = || ElectionConfig {
        admin_account: ALICE,
        election_description: election_description.clone(),
        election_start,
        election_end,
        candidates: candidates.clone(),
        guardians: guardians.clone(),
        eligible_voters: eligible_voters.clone(),
    };

    let init_param = get_init_param();
    initialize(&module_ref, &init_param, &mut chain).expect("Init contract succeeds");

    // `election_start` is before `election_end`.
    let mut init_param = get_init_param();
    init_param.election_start = election_end;
    init_param.election_end = election_start;
    initialize(&module_ref, &init_param, &mut chain)
        .expect_err("Election start time must be before election end time");

    // `election_start` is in the past
    let mut init_param = get_init_param();
    let past_1d = now.clone().checked_sub_days(chrono::Days::new(1)).unwrap();
    init_param.election_start = past_1d.try_into().expect("Valid datetime");
    initialize(&module_ref, &init_param, &mut chain).expect_err("Start time must be in the future");

    // Empty `election_description`
    let mut init_param = get_init_param();
    init_param.election_description = "".to_string();
    initialize(&module_ref, &init_param, &mut chain).expect_err("Must have non-empty description");

    // Empty `candidates` list
    let mut init_param = get_init_param();
    init_param.candidates = vec![];
    initialize(&module_ref, &init_param, &mut chain)
        .expect_err("Must have non-empty list of candidates");

    // Duolicates found in `candidates` list
    let candidates = vec![
        ChecksumUrl {
            url:  "https://candidates.concordium.com/peter".to_string(),
            hash: HashSha2256([0; 32]),
        },
        ChecksumUrl {
            url:  "https://candidates.concordium.com/peter".to_string(),
            hash: HashSha2256([0; 32]),
        },
    ];
    let mut init_param = get_init_param();
    init_param.candidates = candidates;
    initialize(&module_ref, &init_param, &mut chain)
        .expect_err("Must not contain duplicate candidates");

    // Empty `guardians` list
    let mut init_param = get_init_param();
    init_param.guardians = vec![];
    initialize(&module_ref, &init_param, &mut chain)
        .expect_err("Must have non-empty list of guardians");

    // Empty `eligible_voters` url
    let mut init_param = get_init_param();
    init_param.eligible_voters.url = "".to_string();
    initialize(&module_ref, &init_param, &mut chain)
        .expect_err("Must have non-empty eligible_voters url");
}

#[test]
fn test_init_config() {
    let (mut chain, module_ref) = new_chain_and_module();

    let candidates = vec![
        ChecksumUrl {
            url:  "https://candidates.concordium.com/john".to_string(),
            hash: HashSha2256([0; 32]),
        },
        ChecksumUrl {
            url:  "https://candidates.concordium.com/peter".to_string(),
            hash: HashSha2256([1; 32]),
        },
    ];
    let guardians = vec![BOB, CAROLINE];
    let election_start = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::seconds(5))
        .unwrap();
    let election_end = election_start
        .checked_add_days(chrono::Days::new(1))
        .unwrap();
    let eligible_voters = ChecksumUrl {
        url:  "http://some.election/voters".to_string(),
        hash: HashSha2256([0u8; 32]),
    };

    let init_param = ElectionConfig {
        admin_account: ALICE,
        election_description: "Test election".to_string(),
        election_start: election_start.try_into().expect("Valid datetime"),
        election_end: election_end.try_into().expect("Valid datetime"),
        candidates,
        guardians,
        eligible_voters,
    };
    let init = initialize(&module_ref, &init_param, &mut chain).expect("Init contract succeeds");
    let invocation =
        view_config(&mut chain, &init.contract_address).expect("Can invoke config entrypoint");
    let config: ElectionConfig = invocation.parse_return_value().expect("Can parse value");
    assert_eq!(config.admin_account, ALICE);
}

#[test]
fn test_receive_ballot() {
    let (mut chain, contract_address) = new_chain_and_contract();
    let config: ElectionConfig = view_config(&mut chain, &contract_address)
        .expect("Can invoke config entrypoint")
        .parse_return_value()
        .expect("Can parse value");

    let param = vec![0u8, 32u8, 55u8, 3u8];
    register_votes_update(&mut chain, &contract_address, &ALICE_ADDR, &param)
        .expect_err("Vote registration prior to election window fails");

    transition_to_open(&mut chain, &config);

    // Election window opens
    register_votes_update(&mut chain, &contract_address, &ALICE_ADDR, &param)
        .expect("Can register votes");

    register_votes_update(
        &mut chain,
        &contract_address,
        &Address::Contract(ContractAddress {
            index:    0,
            subindex: 0,
        }),
        &param,
    )
    .expect_err("Fails to register vote with contract sender");

    transition_to_closed(&mut chain, &config);

    // Election window closed
    register_votes_update(&mut chain, &contract_address, &ALICE_ADDR, &param)
        .expect_err("Vote registration prior to election window fails");
}

#[test]
fn test_receive_guardian_key() {
    let (mut chain, contract_address) = new_chain_and_contract();
    let config: ElectionConfig = view_config(&mut chain, &contract_address)
        .expect("Can invoke config entrypoint")
        .parse_return_value()
        .expect("Can parse value");

    let param = vec![0, 1, 2, 5, 1, 6, 7];
    let param_other = vec![1, 2, 3, 4, 5, 1, 2, 3];
    register_guardian_final_key_update(&mut chain, &contract_address, &BOB_ADDR, &param)
        .expect("Key registration should succeed");

    register_guardian_final_key_update(&mut chain, &contract_address, &DANIEL_ADDR, &param_other)
        .expect("Key registration should succeed");

    register_guardian_final_key_update(&mut chain, &contract_address, &ALICE_ADDR, &param)
        .expect_err("Key registration should fail due to not being in the list of guardians");

    let contract_sender = Address::Contract(ContractAddress {
        index:    0,
        subindex: 0,
    });
    register_guardian_final_key_update(&mut chain, &contract_address, &contract_sender, &param)
        .expect_err("Cannot register keys from contract sender");

    register_guardian_final_key_update(&mut chain, &contract_address, &BOB_ADDR, &param)
        .expect_err("Key registration should fail due to duplicate entry");

    transition_to_open(&mut chain, &config);

    // Election window opens
    register_guardian_final_key_update(&mut chain, &contract_address, &CAROLINE_ADDR, &param)
        .expect_err("Key registration should fail when setup phase expires");

    let guardians_state: GuardiansState = view_guardians_state(&mut chain, &contract_address)
        .expect("Can invoke entrypoint")
        .parse_return_value()
        .expect("Can parse value");

    let expected_result: GuardiansState = vec![
        (BOB, GuardianState {
            final_key: Some(param),
            ..Default::default()
        }),
        (CAROLINE, GuardianState {
            ..Default::default()
        }),
        (DANIEL, GuardianState {
            final_key: Some(param_other),
            ..Default::default()
        }),
    ];
    assert_eq!(guardians_state, expected_result);
}

#[test]
fn test_receive_election_result() {
    let (mut chain, contract_address) = new_chain_and_contract();
    let config: ElectionConfig = view_config(&mut chain, &contract_address)
        .expect("Can invoke entrypoint")
        .parse_return_value()
        .expect("Can parse value");
    let valid_param = vec![10; config.candidates.len()];

    post_election_result_update(&mut chain, &contract_address, &ALICE_ADDR, &valid_param)
        .expect_err("Cannot post election result when election is not yet over");

    transition_to_closed(&mut chain, &config);

    // Election window closed
    let invalid_param = vec![10; config.candidates.len() + 1];
    post_election_result_update(&mut chain, &contract_address, &ALICE_ADDR, &invalid_param)
        .expect_err("Cannot submit election result with too many vote counts");

    let invalid_param = vec![10; config.candidates.len() - 1];
    post_election_result_update(&mut chain, &contract_address, &ALICE_ADDR, &invalid_param)
        .expect_err("Cannot submit election result with insufficient vote counts");

    let contract_sender = Address::Contract(ContractAddress {
        index:    0,
        subindex: 0,
    });
    post_election_result_update(
        &mut chain,
        &contract_address,
        &contract_sender,
        &valid_param,
    )
    .expect_err("Cannot submit election result from a contract address");

    let non_admin_account_sender = BOB_ADDR;
    post_election_result_update(
        &mut chain,
        &contract_address,
        &non_admin_account_sender,
        &valid_param,
    )
    .expect_err("Cannot submit election result from a non-admin account");

    post_election_result_update(&mut chain, &contract_address, &ALICE_ADDR, &valid_param)
        .expect("Can post election result");
    let election_result: ViewElectionResultQueryResponse =
        view_election_result(&mut chain, &contract_address)
            .expect("Can invoke entrypoint")
            .parse_return_value()
            .expect("Can parse value");
    let expected_result: Vec<CandidateResult> = config
        .candidates
        .iter()
        .zip(valid_param)
        .map(|(candidate, cummulative_votes)| CandidateResult {
            candidate: candidate.clone(),
            cummulative_votes,
        })
        .collect();
    assert_eq!(election_result, Some(expected_result));
}

/// Shifts the block time to the election start time.
fn transition_to_open(chain: &mut Chain, config: &ElectionConfig) {
    let dur_until_open = chain.block_time().duration_between(config.election_start);
    chain
        .tick_block_time(dur_until_open)
        .expect("Block time does not overflow");
}

/// Shifts the block time to after the election end time.
fn transition_to_closed(chain: &mut Chain, config: &ElectionConfig) {
    let dur_until_closed = chain
        .block_time()
        .duration_between(config.election_end)
        .checked_add(Duration::from_millis(1))
        .expect("Does not overflow");
    chain
        .tick_block_time(dur_until_closed)
        .expect("Block time does not overflow");
}

/// Performs contract update at `post_election_result` entrypoint.
fn post_election_result_update(
    chain: &mut Chain,
    address: &ContractAddress,
    sender: &Address,
    param: &PostResultParameter,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount:       Amount::zero(),
        address:      *address,
        receive_name: OwnedReceiveName::new_unchecked("election.postElectionResult".to_string()),
        message:      OwnedParameter::from_serial(&param).expect("Parameter within size bounds"),
    };

    chain.contract_update(SIGNER, ALICE, *sender, Energy::from(10_000), payload)
}

/// Performs contract update at `post_election_result` entrypoint.
fn register_guardian_final_key_update(
    chain: &mut Chain,
    address: &ContractAddress,
    sender: &Address,
    param: &RegisterGuardianFinalKeyParameter,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount:       Amount::zero(),
        address:      *address,
        receive_name: OwnedReceiveName::new_unchecked(
            "election.registerGuardianFinalKey".to_string(),
        ),
        message:      OwnedParameter::from_serial(&param).expect("Parameter within size bounds"),
    };

    chain.contract_update(SIGNER, ALICE, *sender, Energy::from(10_000), payload)
}

fn view_guardians_state(
    chain: &mut Chain,
    address: &ContractAddress,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount:       Amount::zero(),
        address:      *address,
        receive_name: OwnedReceiveName::new_unchecked("election.viewGuardiansState".to_string()),
        message:      OwnedParameter::empty(),
    };

    chain.contract_invoke(ALICE, ALICE_ADDR, Energy::from(10_000), payload)
}

/// Invokes `config` entrypoint
fn view_election_result(
    chain: &mut Chain,
    address: &ContractAddress,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount:       Amount::zero(),
        address:      *address,
        receive_name: OwnedReceiveName::new_unchecked("election.viewElectionResult".to_string()),
        message:      OwnedParameter::empty(),
    };

    chain.contract_invoke(ALICE, ALICE_ADDR, Energy::from(10_000), payload)
}

/// Performs contract update at `register_votes` entrypoint.
fn register_votes_update(
    chain: &mut Chain,
    address: &ContractAddress,
    sender: &Address,
    param: &RegisterVotesParameter,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount:       Amount::zero(),
        address:      *address,
        receive_name: OwnedReceiveName::new_unchecked("election.registerVotes".to_string()),
        message:      OwnedParameter::from_serial(&param).expect("Parameter within size bounds"),
    };

    chain.contract_update(SIGNER, ALICE, *sender, Energy::from(10_000), payload)
}

/// Invokes `config` entrypoint
fn view_config(
    chain: &mut Chain,
    address: &ContractAddress,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount:       Amount::zero(),
        address:      *address,
        receive_name: OwnedReceiveName::new_unchecked("election.viewConfig".to_string()),
        message:      OwnedParameter::empty(),
    };

    chain.contract_invoke(ALICE, ALICE_ADDR, Energy::from(10_000), payload)
}

fn new_chain_and_contract() -> (Chain, ContractAddress) {
    let (mut chain, module_ref) = new_chain_and_module();

    let candidates = vec![
        ChecksumUrl {
            url:  "https://candidates.concordium.com/john".to_string(),
            hash: HashSha2256([0; 32]),
        },
        ChecksumUrl {
            url:  "https://candidates.concordium.com/peter".to_string(),
            hash: HashSha2256([1; 32]),
        },
    ];
    let guardians = vec![BOB, CAROLINE, DANIEL];
    let election_start = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::seconds(5))
        .unwrap();
    let election_end = election_start
        .checked_add_days(chrono::Days::new(1))
        .unwrap();
    let eligible_voters = ChecksumUrl {
        url:  "http://some.election/voters".to_string(),
        hash: HashSha2256([0u8; 32]),
    };

    // Default admin account
    let init_param = ElectionConfig {
        admin_account: ALICE,
        election_description: "Test election".to_string(),
        election_start: election_start.try_into().expect("Valid datetime"),
        election_end: election_end.try_into().expect("Valid datetime"),
        candidates,
        guardians,
        eligible_voters,
    };
    let init = initialize(&module_ref, &init_param, &mut chain).expect("Init contract succeeds");

    (chain, init.contract_address)
}

fn new_chain_and_module() -> (Chain, ModuleReference) {
    let now = chrono::Utc::now().try_into().unwrap();
    // Initialize the test chain.
    let mut chain = ChainBuilder::new()
        .block_time(now)
        .build()
        .expect("Can build chain");
    // Create the test account.
    chain.create_account(Account::new(ALICE, ACC_INITIAL_BALANCE));
    chain.create_account(Account::new(BOB, ACC_INITIAL_BALANCE));
    chain.create_account(Account::new(CAROLINE, ACC_INITIAL_BALANCE));
    chain.create_account(Account::new(DANIEL, ACC_INITIAL_BALANCE));
    // Load the module.
    let module = module_load_v1("./concordium-out/module.wasm.v1").expect("Module exists at path");
    // Deploy the module.
    let deployment = chain
        .module_deploy_v1(SIGNER, ALICE, module)
        .expect("Deploy valid module");

    (chain, deployment.module_reference)
}

/// Helper method for initializing the contract.
fn initialize(
    module_ref: &ModuleReference,
    init_param: &ElectionConfig,
    chain: &mut Chain,
) -> Result<ContractInitSuccess, ContractInitError> {
    let payload = InitContractPayload {
        amount:    Amount::zero(),
        mod_ref:   *module_ref,
        init_name: OwnedContractName::new_unchecked("init_election".to_string()),
        param:     OwnedParameter::from_serial(init_param).expect("Parameter within size bounds"),
    };
    // Initialize the contract.
    chain.contract_init(SIGNER, ALICE, Energy::from(10_000), payload)
}
