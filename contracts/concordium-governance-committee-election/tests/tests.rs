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

const DAVE: AccountAddress = AccountAddress([3u8; 32]);
const DAVE_ADDR: Address = Address::Account(DAVE);

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
    let future_1d = now.checked_add_days(chrono::Days::new(1)).unwrap();
    let future_2d = now.checked_add_days(chrono::Days::new(2)).unwrap();
    let election_start = now.try_into().expect("Valid datetime");
    let election_end = future_1d.try_into().expect("Valid datetime");
    let decryption_deadline = future_2d.try_into().expect("Valid datetime");
    let eligible_voters = EligibleVoters {
        data:       ChecksumUrl {
            url:  "http://some.election/voters".to_string(),
            hash: HashSha2256([0u8; 32]),
        },
        parameters: EligibleVotersParameters {
            start_time: Timestamp::from_timestamp_millis(0),
            end_time:   Timestamp::from_timestamp_millis(0),
        },
    };
    let election_manifest = ChecksumUrl {
        url:  "http://some.election/manifest".to_string(),
        hash: HashSha2256([1u8; 32]),
    };
    let election_parameters = ChecksumUrl {
        url:  "http://some.election/parameters".to_string(),
        hash: HashSha2256([2u8; 32]),
    };
    let election_description = "Test election".to_string();

    let get_init_param = || InitParameter {
        admin_account: ALICE,
        election_description: election_description.clone(),
        election_start,
        election_end,
        decryption_deadline,
        candidates: candidates.clone(),
        guardians: guardians.clone(),
        eligible_voters: eligible_voters.clone(),
        election_manifest: election_manifest.clone(),
        election_parameters: election_parameters.clone(),
        delegation_string: "Something".into(),
    };

    let init_param = get_init_param();
    initialize(&module_ref, &init_param, &mut chain).expect("Init contract succeeds");

    // `election_start` is before `election_end`.
    let mut init_param = get_init_param();
    init_param.election_start = election_end;
    init_param.election_end = election_start;
    initialize(&module_ref, &init_param, &mut chain)
        .expect_err("Election start time must be before election end time");

    // `election_start` is before `election_end`.
    let mut init_param = get_init_param();
    init_param.election_end = decryption_deadline;
    init_param.decryption_deadline = election_end;
    initialize(&module_ref, &init_param, &mut chain)
        .expect_err("Election end time must be before decryption deadline");

    // `election_start` is in the past
    let mut init_param = get_init_param();
    let past_1d = now.checked_sub_days(chrono::Days::new(1)).unwrap();
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
    init_param.eligible_voters.data.url = "".to_string();
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
    let decryption_deadline = election_end.checked_add_days(chrono::Days::new(1)).unwrap();
    let eligible_voters = EligibleVoters {
        data:       ChecksumUrl {
            url:  "http://some.election/voters".to_string(),
            hash: HashSha2256([0u8; 32]),
        },
        parameters: EligibleVotersParameters {
            start_time: Timestamp::from_timestamp_millis(0),
            end_time:   Timestamp::from_timestamp_millis(0),
        },
    };
    let election_manifest = ChecksumUrl {
        url:  "http://some.election/manifest".to_string(),
        hash: HashSha2256([1u8; 32]),
    };
    let election_parameters = ChecksumUrl {
        url:  "http://some.election/parameters".to_string(),
        hash: HashSha2256([2u8; 32]),
    };

    let init_param = InitParameter {
        admin_account: ALICE,
        election_description: "Test election".to_string(),
        election_start: election_start.try_into().expect("Valid datetime"),
        election_end: election_end.try_into().expect("Valid datetime"),
        decryption_deadline: decryption_deadline.try_into().expect("Valid datetime"),
        candidates,
        guardians,
        eligible_voters,
        election_manifest,
        election_parameters,
        delegation_string: "Something".into(),
    };
    let init = initialize(&module_ref, &init_param, &mut chain).expect("Init contract succeeds");
    let invocation =
        view_config(&mut chain, &init.contract_address).expect("Can invoke config entrypoint");
    let config: InitParameter = invocation.parse_return_value().expect("Can parse value");
    assert_eq!(config.admin_account, ALICE);
}

#[test]
fn test_receive_guardian_public_key() {
    let (mut chain, contract_address) = new_chain_and_contract();
    let config: InitParameter = view_config(&mut chain, &contract_address)
        .expect("Can invoke config entrypoint")
        .parse_return_value()
        .expect("Can parse value");

    let param = vec![0, 1, 2, 5, 1, 6, 7];
    let param_other = vec![1, 2, 3, 4, 5, 1, 2, 3];
    register_guardian_public_key_update(&mut chain, &contract_address, &BOB_ADDR, &param)
        .expect("Key registration should succeed");

    register_guardian_public_key_update(&mut chain, &contract_address, &DAVE_ADDR, &param_other)
        .expect("Key registration should succeed");

    register_guardian_public_key_update(&mut chain, &contract_address, &ALICE_ADDR, &param)
        .expect_err("Key registration should fail due to not being in the list of guardians");

    let contract_sender = Address::Contract(ContractAddress {
        index:    0,
        subindex: 0,
    });
    register_guardian_public_key_update(&mut chain, &contract_address, &contract_sender, &param)
        .expect_err("Cannot register keys from contract sender");

    register_guardian_public_key_update(&mut chain, &contract_address, &BOB_ADDR, &param)
        .expect_err("Key registration should fail due to duplicate entry");

    transition_to_open(&mut chain, &config);

    // Setup window closed
    register_guardian_public_key_update(&mut chain, &contract_address, &CAROLINE_ADDR, &param)
        .expect_err("Key registration should fail when setup phase expires");

    let mut guardians_state: GuardiansState = view_guardians_state(&mut chain, &contract_address)
        .expect("Can invoke entrypoint")
        .parse_return_value()
        .expect("Can parse value");
    guardians_state.sort_by_key(|g| g.1.index);
    let expected_result: GuardiansState = vec![
        (BOB, GuardianState {
            public_key: Some(param),
            ..GuardianState::new(1)
        }),
        (CAROLINE, GuardianState::new(2)),
        (DAVE, GuardianState {
            public_key: Some(param_other),
            ..GuardianState::new(3)
        }),
    ];
    assert_eq!(guardians_state, expected_result);
}

#[test]
fn test_receive_guardian_encrypted_share() {
    let (mut chain, contract_address) = new_chain_and_contract();
    let config: InitParameter = view_config(&mut chain, &contract_address)
        .expect("Can invoke config entrypoint")
        .parse_return_value()
        .expect("Can parse value");

    let param = vec![0, 1, 2, 5, 1, 6, 7];
    let param_other = vec![1, 2, 3, 4, 5, 1, 2, 3];
    register_guardian_encrypted_share_update(&mut chain, &contract_address, &BOB_ADDR, &param)
        .expect("Key registration should succeed");

    register_guardian_encrypted_share_update(
        &mut chain,
        &contract_address,
        &DAVE_ADDR,
        &param_other,
    )
    .expect("Key registration should succeed");

    let error: Error = register_guardian_encrypted_share_update(
        &mut chain,
        &contract_address,
        &ALICE_ADDR,
        &param,
    )
    .expect_err("Key registration should fail due to not being in the list of guardians")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(error, Error::Unauthorized, "Unexpected error type");

    let contract_sender = Address::Contract(ContractAddress {
        index:    0,
        subindex: 0,
    });
    let error: Error = register_guardian_encrypted_share_update(
        &mut chain,
        &contract_address,
        &contract_sender,
        &param,
    )
    .expect_err("Cannot register keys from contract sender")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(error, Error::Unauthorized, "Unexpected error type");

    let error: Error =
        register_guardian_encrypted_share_update(&mut chain, &contract_address, &BOB_ADDR, &param)
            .expect_err("Key registration should fail due to duplicate entry")
            .parse_return_value()
            .expect("Deserializes to error type");
    assert_eq!(error, Error::DuplicateEntry, "Unexpected error type");

    transition_to_open(&mut chain, &config);

    // Setup window closed
    let error: Error = register_guardian_encrypted_share_update(
        &mut chain,
        &contract_address,
        &CAROLINE_ADDR,
        &param,
    )
    .expect_err("Key registration should fail when setup phase expires")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(
        error,
        Error::IncorrectElectionPhase,
        "Unexpected error type"
    );

    let mut guardians_state: GuardiansState = view_guardians_state(&mut chain, &contract_address)
        .expect("Can invoke entrypoint")
        .parse_return_value()
        .expect("Can parse value");
    guardians_state.sort_by_key(|x| x.1.index);
    let expected_result: GuardiansState = vec![
        (BOB, GuardianState {
            encrypted_share: Some(param),
            ..GuardianState::new(1)
        }),
        (CAROLINE, GuardianState::new(2)),
        (DAVE, GuardianState {
            encrypted_share: Some(param_other),
            ..GuardianState::new(3)
        }),
    ];
    assert_eq!(guardians_state, expected_result);
}

#[test]
fn test_receive_guardian_status() {
    let (mut chain, contract_address) = new_chain_and_contract();
    let config: InitParameter = view_config(&mut chain, &contract_address)
        .expect("Can invoke config entrypoint")
        .parse_return_value()
        .expect("Can parse value");

    register_guardian_status_update(
        &mut chain,
        &contract_address,
        &BOB_ADDR,
        GuardianStatus::KeyVerificationFailed(vec![DAVE]),
    )
    .expect("Complaint registration should succeed");

    register_guardian_status_update(
        &mut chain,
        &contract_address,
        &DAVE_ADDR,
        GuardianStatus::VerificationSuccessful,
    )
    .expect("Success registration should succeed");

    let error: Error = register_guardian_status_update(
        &mut chain,
        &contract_address,
        &ALICE_ADDR,
        GuardianStatus::VerificationSuccessful,
    )
    .expect_err("Complaint registration should fail due to not being in the list of guardians")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(error, Error::Unauthorized, "Unexpected error type");

    let contract_sender = Address::Contract(ContractAddress {
        index:    0,
        subindex: 0,
    });
    let error: Error = register_guardian_status_update(
        &mut chain,
        &contract_address,
        &contract_sender,
        GuardianStatus::VerificationSuccessful,
    )
    .expect_err("Cannot register complaints from contract sender")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(error, Error::Unauthorized, "Unexpected error type");

    let error: Error = register_guardian_status_update(
        &mut chain,
        &contract_address,
        &BOB_ADDR,
        GuardianStatus::VerificationSuccessful,
    )
    .expect_err("Complaint registration should fail due to duplicate entry")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(error, Error::DuplicateEntry, "Unexpected error type");

    transition_to_open(&mut chain, &config);

    // Setup window closed
    let error: Error = register_guardian_status_update(
        &mut chain,
        &contract_address,
        &CAROLINE_ADDR,
        GuardianStatus::VerificationSuccessful,
    )
    .expect_err("Complaint registration should fail when setup phase expires")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(
        error,
        Error::IncorrectElectionPhase,
        "Unexpected error type"
    );

    let mut guardians_state: GuardiansState = view_guardians_state(&mut chain, &contract_address)
        .expect("Can invoke entrypoint")
        .parse_return_value()
        .expect("Can parse value");
    guardians_state.sort_by_key(|g| g.1.index);
    let expected_result: GuardiansState = vec![
        (BOB, GuardianState {
            status: Some(GuardianStatus::KeyVerificationFailed(vec![DAVE])),
            ..GuardianState::new(1)
        }),
        (CAROLINE, GuardianState::new(2)),
        (DAVE, GuardianState {
            status: Some(GuardianStatus::VerificationSuccessful),
            ..GuardianState::new(3)
        }),
    ];
    assert_eq!(guardians_state, expected_result);
}

#[test]
fn test_receive_ballot() {
    let (mut chain, contract_address) = new_chain_and_contract();
    let config: InitParameter = view_config(&mut chain, &contract_address)
        .expect("Can invoke config entrypoint")
        .parse_return_value()
        .expect("Can parse value");

    let param = RegisterVotesParameter::from(vec![0u8, 32u8, 55u8, 3u8]);
    let error: Error = register_votes_update(&mut chain, &contract_address, &ALICE_ADDR, &param)
        .expect_err("Vote registration prior to election window fails")
        .parse_return_value()
        .expect("Deserializes to error type");
    assert_eq!(
        error,
        Error::IncorrectElectionPhase,
        "Unexpected error type"
    );

    transition_to_open(&mut chain, &config);

    // Election window opens
    register_votes_update(&mut chain, &contract_address, &ALICE_ADDR, &param)
        .expect("Can register votes");

    let error: Error = register_votes_update(
        &mut chain,
        &contract_address,
        &Address::Contract(ContractAddress {
            index:    0,
            subindex: 0,
        }),
        &param,
    )
    .expect_err("Fails to register vote with contract sender")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(error, Error::Unauthorized, "Unexpected error type");

    transition_to_closed(&mut chain, &config);

    // Election window closed
    let error: Error = register_votes_update(&mut chain, &contract_address, &ALICE_ADDR, &param)
        .expect_err("Vote registration prior to election window fails")
        .parse_return_value()
        .expect("Deserializes to error type");
    assert_eq!(
        error,
        Error::IncorrectElectionPhase,
        "Unexpected error type"
    );
}

#[test]
fn test_receive_guardian_decryption_share() {
    let (mut chain, contract_address) = new_chain_and_contract();
    let config: InitParameter = view_config(&mut chain, &contract_address)
        .expect("Can invoke config entrypoint")
        .parse_return_value()
        .expect("Can parse value");

    let param = vec![0, 1, 2, 5, 1, 6, 7];
    let param_other = vec![1, 2, 3, 4, 5, 1, 2, 3];

    let error: Error =
        post_decryption_share_update(&mut chain, &contract_address, &BOB_ADDR, &param)
            .expect_err("Registering decryption share should fail in before election_end")
            .parse_return_value()
            .expect("Can deserialize error");
    assert_eq!(
        error,
        Error::IncorrectElectionPhase,
        "Unexpected error type"
    );

    transition_to_open(&mut chain, &config);

    let error: Error =
        post_decryption_share_update(&mut chain, &contract_address, &BOB_ADDR, &param)
            .expect_err("Registering decryption share should fail in before election_end")
            .parse_return_value()
            .expect("Can deserialize error");
    assert_eq!(
        error,
        Error::IncorrectElectionPhase,
        "Unexpected error type"
    );

    transition_to_closed(&mut chain, &config);

    post_decryption_share_update(&mut chain, &contract_address, &BOB_ADDR, &param)
        .expect("Decryption share registration should succeed");
    post_decryption_share_update(&mut chain, &contract_address, &DAVE_ADDR, &param_other)
        .expect("Decryption share registration should succeed");

    let error: Error =
        post_decryption_share_update(&mut chain, &contract_address, &ALICE_ADDR, &param)
            .expect_err("Registration should fail due to not being in the list of guardians")
            .parse_return_value()
            .expect("Deserializes to error type");
    assert_eq!(error, Error::Unauthorized, "Unexpected error type");

    let contract_sender = Address::Contract(ContractAddress {
        index:    0,
        subindex: 0,
    });
    let error: Error =
        post_decryption_share_update(&mut chain, &contract_address, &contract_sender, &param)
            .expect_err("Cannot register from contract sender")
            .parse_return_value()
            .expect("Deserializes to error type");
    assert_eq!(error, Error::Unauthorized, "Unexpected error type");

    let error: Error =
        post_decryption_share_update(&mut chain, &contract_address, &BOB_ADDR, &param)
            .expect_err("Registration should fail due to duplicate entry")
            .parse_return_value()
            .expect("Deserializes to error type");
    assert_eq!(error, Error::DuplicateEntry, "Unexpected error type");

    transition_to_decryption_deadline_passed(&mut chain, &config);

    let error: Error =
        post_decryption_share_update(&mut chain, &contract_address, &CAROLINE_ADDR, &param)
            .expect_err("Registration should fail when deadline has passed")
            .parse_return_value()
            .expect("Deserializes to error type");
    assert_eq!(
        error,
        Error::IncorrectElectionPhase,
        "Unexpected error type"
    );

    let mut guardians_state: GuardiansState = view_guardians_state(&mut chain, &contract_address)
        .expect("Can invoke entrypoint")
        .parse_return_value()
        .expect("Can parse value");
    guardians_state.sort_by_key(|x| x.1.index);
    let expected_result: GuardiansState = vec![
        (BOB, GuardianState {
            decryption_share: Some(param),
            ..GuardianState::new(1)
        }),
        (CAROLINE, GuardianState::new(2)),
        (DAVE, GuardianState {
            decryption_share: Some(param_other),
            ..GuardianState::new(3)
        }),
    ];
    assert_eq!(guardians_state, expected_result);
}

#[test]
fn test_receive_guardian_decryption_proof_response_share() {
    let (mut chain, contract_address) = new_chain_and_contract();
    let config: InitParameter = view_config(&mut chain, &contract_address)
        .expect("Can invoke config entrypoint")
        .parse_return_value()
        .expect("Can parse value");

    let param = vec![0, 1, 2, 5, 1, 6, 7];
    let param_other = vec![1, 2, 3, 4, 5, 1, 2, 3];

    let error: Error = post_decryption_proof_response_share_update(
        &mut chain,
        &contract_address,
        &BOB_ADDR,
        &param,
    )
    .expect_err("Registering decryption share should fail in before election_end")
    .parse_return_value()
    .expect("Can deserialize error");
    assert_eq!(
        error,
        Error::IncorrectElectionPhase,
        "Unexpected error type"
    );

    transition_to_open(&mut chain, &config);

    let error: Error = post_decryption_proof_response_share_update(
        &mut chain,
        &contract_address,
        &BOB_ADDR,
        &param,
    )
    .expect_err("Registering decryption share should fail in before election_end")
    .parse_return_value()
    .expect("Can deserialize error");
    assert_eq!(
        error,
        Error::IncorrectElectionPhase,
        "Unexpected error type"
    );

    transition_to_closed(&mut chain, &config);

    post_decryption_proof_response_share_update(&mut chain, &contract_address, &BOB_ADDR, &param)
        .expect("Decryption share registration should succeed");

    transition_to_decryption_deadline_passed(&mut chain, &config);

    post_decryption_proof_response_share_update(
        &mut chain,
        &contract_address,
        &DAVE_ADDR,
        &param_other,
    )
    .expect("Decryption share registration should succeed");

    let error: Error = post_decryption_proof_response_share_update(
        &mut chain,
        &contract_address,
        &ALICE_ADDR,
        &param,
    )
    .expect_err("Registration should fail due to not being in the list of guardians")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(error, Error::Unauthorized, "Unexpected error type");

    let contract_sender = Address::Contract(ContractAddress {
        index:    0,
        subindex: 0,
    });
    let error: Error = post_decryption_proof_response_share_update(
        &mut chain,
        &contract_address,
        &contract_sender,
        &param,
    )
    .expect_err("Cannot register from contract sender")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(error, Error::Unauthorized, "Unexpected error type");

    let error: Error = post_decryption_proof_response_share_update(
        &mut chain,
        &contract_address,
        &BOB_ADDR,
        &param,
    )
    .expect_err("Registration should fail due to duplicate entry")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(error, Error::DuplicateEntry, "Unexpected error type");

    let mut guardians_state: GuardiansState = view_guardians_state(&mut chain, &contract_address)
        .expect("Can invoke entrypoint")
        .parse_return_value()
        .expect("Can parse value");
    guardians_state.sort_by_key(|x| x.1.index);
    let expected_result: GuardiansState = vec![
        (BOB, GuardianState {
            decryption_share_proof: Some(param),
            ..GuardianState::new(1)
        }),
        (CAROLINE, GuardianState::new(2)),
        (DAVE, GuardianState {
            decryption_share_proof: Some(param_other),
            ..GuardianState::new(3)
        }),
    ];
    assert_eq!(guardians_state, expected_result);
}

#[test]
fn test_receive_election_result() {
    let (mut chain, contract_address) = new_chain_and_contract();
    let config: InitParameter = view_config(&mut chain, &contract_address)
        .expect("Can invoke entrypoint")
        .parse_return_value()
        .expect("Can parse value");
    let valid_param = vec![10; config.candidates.len()];

    let error: Error =
        post_election_result_update(&mut chain, &contract_address, &ALICE_ADDR, &valid_param)
            .expect_err("Cannot post election result when election is not yet over")
            .parse_return_value()
            .expect("Deserializes to error type");
    assert_eq!(
        error,
        Error::IncorrectElectionPhase,
        "Unexpected error type"
    );

    transition_to_closed(&mut chain, &config);

    // Election window closed
    let invalid_param = vec![10; config.candidates.len() + 1];
    let error: Error =
        post_election_result_update(&mut chain, &contract_address, &ALICE_ADDR, &invalid_param)
            .expect_err("Cannot submit election result with too many vote counts")
            .parse_return_value()
            .expect("Deserializes to error type");
    assert_eq!(error, Error::Malformed, "Unexpected error type");

    let invalid_param = vec![10; config.candidates.len() - 1];
    let error: Error =
        post_election_result_update(&mut chain, &contract_address, &ALICE_ADDR, &invalid_param)
            .expect_err("Cannot submit election result with insufficient vote counts")
            .parse_return_value()
            .expect("Deserializes to error type");
    assert_eq!(error, Error::Malformed, "Unexpected error type");

    let contract_sender = Address::Contract(ContractAddress {
        index:    0,
        subindex: 0,
    });
    let error: Error = post_election_result_update(
        &mut chain,
        &contract_address,
        &contract_sender,
        &valid_param,
    )
    .expect_err("Cannot submit election result from a contract address")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(error, Error::Unauthorized, "Unexpected error type");

    let non_admin_account_sender = BOB_ADDR;
    let error: Error = post_election_result_update(
        &mut chain,
        &contract_address,
        &non_admin_account_sender,
        &valid_param,
    )
    .expect_err("Cannot submit election result from a non-admin account")
    .parse_return_value()
    .expect("Deserializes to error type");
    assert_eq!(error, Error::Unauthorized, "Unexpected error type");

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
fn transition_to_open(chain: &mut Chain, config: &InitParameter) {
    let dur_until_open = chain.block_time().duration_between(config.election_start);
    chain
        .tick_block_time(dur_until_open)
        .expect("Block time does not overflow");
}

/// Shifts the block time to after the election end time.
fn transition_to_closed(chain: &mut Chain, config: &InitParameter) {
    let dur_until_closed = chain
        .block_time()
        .duration_between(config.election_end)
        .checked_add(Duration::from_millis(1))
        .expect("Does not overflow");
    chain
        .tick_block_time(dur_until_closed)
        .expect("Block time does not overflow");
}

/// Shifts the block time to after the decryption deadline.
fn transition_to_decryption_deadline_passed(chain: &mut Chain, config: &InitParameter) {
    let dur_until_deadline_passed = chain
        .block_time()
        .duration_between(config.decryption_deadline)
        .checked_add(Duration::from_millis(1))
        .expect("Does not overflow");
    chain
        .tick_block_time(dur_until_deadline_passed)
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

/// Performs contract update at `register_guardian_public_key` entrypoint.
fn register_guardian_public_key_update(
    chain: &mut Chain,
    address: &ContractAddress,
    sender: &Address,
    param: &RegisterGuardianPublicKeyParameter,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount:       Amount::zero(),
        address:      *address,
        receive_name: OwnedReceiveName::new_unchecked(
            "election.registerGuardianPublicKey".to_string(),
        ),
        message:      OwnedParameter::from_serial(&param).expect("Parameter within size bounds"),
    };

    chain.contract_update(SIGNER, ALICE, *sender, Energy::from(10_000), payload)
}

/// Performs contract update at `register_guardian_encrypted_share` entrypoint.
fn register_guardian_encrypted_share_update(
    chain: &mut Chain,
    address: &ContractAddress,
    sender: &Address,
    param: &RegisterGuardianEncryptedShareParameter,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount:       Amount::zero(),
        address:      *address,
        receive_name: OwnedReceiveName::new_unchecked(
            "election.registerGuardianEncryptedShare".to_string(),
        ),
        message:      OwnedParameter::from_serial(&param).expect("Parameter within size bounds"),
    };

    chain.contract_update(SIGNER, ALICE, *sender, Energy::from(10_000), payload)
}

/// Performs contract update at `register_guardian_complaint` entrypoint.
fn register_guardian_status_update(
    chain: &mut Chain,
    address: &ContractAddress,
    sender: &Address,
    status: GuardianStatus,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount:       Amount::zero(),
        address:      *address,
        receive_name: OwnedReceiveName::new_unchecked(
            "election.registerGuardianStatus".to_string(),
        ),
        message:      OwnedParameter::from_serial(&status).expect("Parameter within size bounds"),
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

/// Performs contract update at `post_decryption_share` entrypoint.
fn post_decryption_share_update(
    chain: &mut Chain,
    address: &ContractAddress,
    sender: &Address,
    param: &Vec<u8>,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount:       Amount::zero(),
        address:      *address,
        receive_name: OwnedReceiveName::new_unchecked("election.postDecryptionShare".to_string()),
        message:      OwnedParameter::from_serial(&param).expect("Parameter within size bounds"),
    };

    chain.contract_update(SIGNER, ALICE, *sender, Energy::from(10_000), payload)
}

/// Performs contract update at `post_decryption_proof_response_share`
/// entrypoint.
fn post_decryption_proof_response_share_update(
    chain: &mut Chain,
    address: &ContractAddress,
    sender: &Address,
    param: &Vec<u8>,
) -> Result<ContractInvokeSuccess, ContractInvokeError> {
    let payload = UpdateContractPayload {
        amount:       Amount::zero(),
        address:      *address,
        receive_name: OwnedReceiveName::new_unchecked(
            "election.postDecryptionProofResponseShare".to_string(),
        ),
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
    let guardians = vec![BOB, CAROLINE, DAVE];
    let election_start = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::seconds(5))
        .unwrap();
    let election_end = election_start
        .checked_add_days(chrono::Days::new(1))
        .unwrap();
    let decryption_deadline = election_end.checked_add_days(chrono::Days::new(1)).unwrap();
    let eligible_voters = EligibleVoters {
        data:       ChecksumUrl {
            url:  "http://some.election/voters".to_string(),
            hash: HashSha2256([0u8; 32]),
        },
        parameters: EligibleVotersParameters {
            start_time: Timestamp::from_timestamp_millis(0),
            end_time:   Timestamp::from_timestamp_millis(0),
        },
    };
    let election_manifest = ChecksumUrl {
        url:  "http://some.election/manifest".to_string(),
        hash: HashSha2256([1u8; 32]),
    };
    let election_parameters = ChecksumUrl {
        url:  "http://some.election/parameters".to_string(),
        hash: HashSha2256([2u8; 32]),
    };

    // Default admin account
    let init_param = InitParameter {
        admin_account: ALICE,
        election_description: "Test election".to_string(),
        election_start: election_start.try_into().expect("Valid datetime"),
        election_end: election_end.try_into().expect("Valid datetime"),
        decryption_deadline: decryption_deadline.try_into().expect("Valid datetime"),
        candidates,
        guardians,
        eligible_voters,
        election_manifest,
        election_parameters,
        delegation_string: "Something".into(),
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
    chain.create_account(Account::new(DAVE, ACC_INITIAL_BALANCE));
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
        amount:    Amount::zero(),
        mod_ref:   *module_ref,
        init_name: OwnedContractName::new_unchecked("init_election".to_string()),
        param:     OwnedParameter::from_serial(init_param).expect("Parameter within size bounds"),
    };
    // Initialize the contract.
    chain.contract_init(SIGNER, ALICE, Energy::from(10_000), payload)
}
