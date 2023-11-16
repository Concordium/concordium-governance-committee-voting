use chrono::{Days, Duration, Utc};
use concordium_governance_committee_election::*;
use concordium_smart_contract_testing::*;
use concordium_std::HashSha3256;

/// A test account.
const ALICE: AccountAddress = AccountAddress([0u8; 32]);
const ALICE_ADDR: Address = Address::Account(ALICE);

const BOB: AccountAddress = AccountAddress([1u8; 32]);
const CAROLINE: AccountAddress = AccountAddress([2u8; 32]);

/// The initial balance of the ALICE test account.
const ACC_INITIAL_BALANCE: Amount = Amount::from_ccd(10_000);

/// A [`Signer`] with one set of keys, used for signing transactions.
const SIGNER: Signer = Signer::with_one_key();

/// Test that invoking the `receive` endpoint with the `false` parameter
/// succeeds in updating the contract.
// #[test]
// fn test_throw_no_error() {
//     let (mut chain, init) = initialize();
//
//     // Update the contract via the `receive` entrypoint with the parameter `false`.
//     chain
//         .contract_update(SIGNER, ALICE, ALICE_ADDR, Energy::from(10_000), UpdateContractPayload {
//             address:      init.contract_address,
//             amount:       Amount::zero(),
//             receive_name: OwnedReceiveName::new_unchecked("concordium_governance_committee_election.receive".to_string()),
//             message:      OwnedParameter::from_serial(&false)
//                 .expect("Parameter within size bounds"),
//         })
//         .expect("Update succeeds with `false` as input.");
// }

/// Test that invoking the `receive` endpoint with the `true` parameter
/// results in the `YourError` being thrown.
// #[test]
// fn test_throw_error() {
//     let (mut chain, init) = initialize();
//
//     // Update the contract via the `receive` entrypoint with the parameter `true`.
//     let update = chain
//         .contract_update(SIGNER, ALICE, ALICE_ADDR, Energy::from(10_000), UpdateContractPayload {
//             address:      init.contract_address,
//             amount:       Amount::zero(),
//             receive_name: OwnedReceiveName::new_unchecked("concordium_governance_committee_election.receive".to_string()),
//             message:      OwnedParameter::from_serial(&true).expect("Parameter within size bounds"),
//         })
//         .expect_err("Update fails with `true` as input.");
//
//     // Check that the contract returned `YourError`.
//     let error: Error = update.parse_return_value().expect("Deserialize `Error`");
//     assert_eq!(error, Error::YourError);
// }

#[test]
fn test_receive_vote() {
    let (mut chain, contract_address) = new_chain_and_contract();

    let param = vec![
        Vote {
            candidate_index: 0,
            has_vote: false,
        },
        Vote {
            candidate_index: 1,
            has_vote: true,
        },
    ];
    register_vote_update(&mut chain, &contract_address, &ALICE_ADDR, &param)
        .expect("Can register ballot of expected format");

    register_vote_update(
        &mut chain,
        &contract_address,
        &Address::Contract(ContractAddress {
            index: 0,
            subindex: 0,
        }),
        &param,
    )
    .expect_err("Fails to register vote with contract sender");
}

#[test]
fn test_init_errors() {
    let (mut chain, module_ref) = new_chain_and_module();

    let candidates = vec![
        Candidate {
            name: "John".to_string(),
        },
        Candidate {
            name: "Peter".to_string(),
        },
    ];
    let guardians = vec![BOB, CAROLINE];
    let now = Utc::now().checked_add_signed(Duration::seconds(5)).unwrap();
    let future_1d = now.clone().checked_add_days(Days::new(1)).unwrap();
    let election_start = now.try_into().expect("Valid datetime");
    let election_end = future_1d.try_into().expect("Valid datetime");
    let eligible_voters = EligibleVoters {
        url: "http://some.election/voters".to_string(),
        hash: HashSha3256([0u8; 32]),
    };
    let election_description = "Test election".to_string();

    let get_init_param = || InitParameter {
        admin_account: None,
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
    let past_1d = now.clone().checked_sub_days(Days::new(1)).unwrap();
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
        Candidate {
            name: "John".to_string(),
        },
        Candidate {
            name: "Peter".to_string(),
        },
    ];
    let guardians = vec![BOB, CAROLINE];
    let election_start = Utc::now().checked_add_signed(Duration::seconds(5)).unwrap();
    let election_end = election_start.checked_add_days(Days::new(1)).unwrap();
    let eligible_voters = EligibleVoters {
        url: "http://some.election/voters".to_string(),
        hash: HashSha3256([0u8; 32]),
    };

    // Default admin account
    let mut init_param = InitParameter {
        admin_account: None,
        election_description: "Test election".to_string(),
        election_start: election_start.try_into().expect("Valid datetime"),
        election_end: election_end.try_into().expect("Valid datetime"),
        candidates,
        guardians,
        eligible_voters,
    };
    let init = initialize(&module_ref, &init_param, &mut chain).expect("Init contract succeeds");
    let invocation =
        config_view(&mut chain, &init.contract_address).expect("Can invoke config entrypoint");
    let config: ConfigQueryResponse = invocation.parse_return_value().expect("Can parse value");
    assert_eq!(config.admin_account, ALICE);

    // Explicit admin account
    init_param.admin_account = Some(BOB);
    let init = initialize(&module_ref, &init_param, &mut chain).expect("Init contract succeeds");

    let invocation =
        config_view(&mut chain, &init.contract_address).expect("Can invoke config entrypoint");
    let config: ConfigQueryResponse = invocation.parse_return_value().expect("Can parse value");

    assert_eq!(config.admin_account, BOB);
}

/// Performs contract update at `register_vote` entrypoint.
fn register_vote_update(
    chain: &mut Chain,
    address: &ContractAddress,
    sender: &Address,
    param: &RegisterVoteParameter,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount: Amount::zero(),
        address: *address,
        receive_name: OwnedReceiveName::new_unchecked(
            "concordium_governance_committee_election.registerVotes".to_string(),
        ),
        message: OwnedParameter::from_serial(&param).expect("Parameter within size bounds"),
    };

    chain.contract_update(SIGNER, ALICE, *sender, Energy::from(10_000), payload)
}

/// Invokes `config` entrypoint
fn config_view(
    chain: &mut Chain,
    address: &ContractAddress,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount: Amount::zero(),
        address: *address,
        receive_name: OwnedReceiveName::new_unchecked(
            "concordium_governance_committee_election.config".to_string(),
        ),
        message: OwnedParameter::empty(),
    };

    chain.contract_invoke(ALICE, ALICE_ADDR, Energy::from(10_000), payload)
}

fn new_chain_and_contract() -> (Chain, ContractAddress) {
    let (mut chain, module_ref) = new_chain_and_module();

    let candidates = vec![
        Candidate {
            name: "John".to_string(),
        },
        Candidate {
            name: "Peter".to_string(),
        },
    ];
    let guardians = vec![BOB, CAROLINE];
    let election_start = Utc::now().checked_add_signed(Duration::seconds(5)).unwrap();
    let election_end = election_start.checked_add_days(Days::new(1)).unwrap();
    let eligible_voters = EligibleVoters {
        url: "http://some.election/voters".to_string(),
        hash: HashSha3256([0u8; 32]),
    };

    // Default admin account
    let init_param = InitParameter {
        admin_account: None,
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
    let now = Utc::now().try_into().unwrap();
    // Initialize the test chain.
    let mut chain = ChainBuilder::new()
        .block_time(now)
        .build()
        .expect("Can build chain");
    // Create the test account.
    chain.create_account(Account::new(ALICE, ACC_INITIAL_BALANCE));
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
    init_param: &InitParameter,
    chain: &mut Chain,
) -> Result<ContractInitSuccess, ContractInitError> {
    let payload = InitContractPayload {
        amount: Amount::zero(),
        mod_ref: *module_ref,
        init_name: OwnedContractName::new_unchecked(
            "init_concordium_governance_committee_election".to_string(),
        ),
        param: OwnedParameter::from_serial(init_param).expect("Parameter within size bounds"),
    };
    // Initialize the contract.
    chain.contract_init(SIGNER, ALICE, Energy::from(10_000), payload)
}
