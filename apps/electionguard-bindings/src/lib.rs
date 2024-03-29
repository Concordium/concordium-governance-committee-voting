use eg::{
    ballot::BallotEncrypted,
    ballot_style::BallotStyleIndex,
    contest_selection::{ContestSelection, ContestSelectionPlaintext},
    device::Device,
    election_manifest::{ContestIndex, ElectionManifest},
    election_parameters::ElectionParameters,
    election_record::PreVotingData,
    guardian_public_key::GuardianPublicKey,
    hashes::Hashes,
    hashes_ext::HashesExt,
    joint_election_public_key::JointElectionPublicKey,
};
use election_common::{decode, encode};
use rand::{thread_rng, Rng};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, convert::TryFrom};
use tsify::Tsify;
use util::csprng::Csprng;
use wasm_bindgen::prelude::*;

/// The missing typescript types for election guard structs.
#[wasm_bindgen(typescript_custom_section)]
const TS_APPEND_CONTENT: &'static str = r#"
export type ElectionManifest = {
    label: string;
    contests: {
        label: string;
        selection_limit: number;
        options: {
            label: string;
        }[];
    }[];
    ballot_styles: {
        label: string;
        contests: number[];
    }[];
};
export type ElectionParameters = {
    fixed_parameters: {
        ElectionGuard_Design_Specification: {
            Official: {
                version: number[];
                release: string;
            };
        };
        generation_parameters: {
            q_bits_total: number;
            p_bits_total: number;
            p_bits_msb_fixed_1: number;
            p_middle_bits_source: string;
            p_bits_lsb_fixed_1: number;
        };
        p: string;
        q: string;
        r: string;
        g: string;
    };
    varying_parameters: {
        n: number;
        k: number;
        date: string;
        info: string;
        ballot_chaining: string;
    };
};"#;

/// The contextual parameters necessary to generate the encrypted ballot
#[derive(Debug, Serialize, Deserialize, Clone, Tsify)]
#[tsify(from_wasm_abi)]
pub struct EncryptedBallotContext {
    /// The election manifest. This should be declared externally for each
    /// election.
    pub election_manifest:    ElectionManifest,
    /// The election parameters. These should be generated externally for each
    /// election.
    pub election_parameters:  ElectionParameters,
    /// The guardian public keys, which are registered in the election contract.
    pub guardian_public_keys: Vec<Vec<u8>>,
}

impl TryFrom<EncryptedBallotContext> for PreVotingData {
    type Error = JsError;

    fn try_from(value: EncryptedBallotContext) -> Result<Self, Self::Error> {
        let guardian_public_keys: Vec<GuardianPublicKey> = value
            .guardian_public_keys
            .iter()
            .map(|bytes| decode::<GuardianPublicKey>(bytes))
            .collect::<Result<_, _>>()?;
        let joint_election_public_key =
            JointElectionPublicKey::compute(&value.election_parameters, &guardian_public_keys)
                .map_err(|e| {
                    JsError::new(&format!(
                        "Could not compute joint election public key: {}",
                        e
                    ))
                })?;

        let hashes = Hashes::compute(&value.election_parameters, &value.election_manifest)
            .map_err(|e| {
                JsError::new(&format!(
                    "Could not compute hashes from election context: {}",
                    e
                ))
            })?;

        let hashes_ext = HashesExt::compute(
            &value.election_parameters,
            &hashes,
            &joint_election_public_key,
        );

        let pre_voting_data = PreVotingData {
            manifest: value.election_manifest.clone(),
            parameters: value.election_parameters,
            hashes,
            hashes_ext,
            public_key: joint_election_public_key,
        };

        Ok(pre_voting_data)
    }
}

/// Wrapper around a vector of bool flags, representing a selection of
/// candidates for a single election guard contest.
#[derive(Debug, Serialize, Deserialize, Tsify)]
#[tsify(from_wasm_abi)]
pub struct SingleContestSelection(pub Vec<bool>);

impl From<SingleContestSelection> for BTreeMap<ContestIndex, ContestSelection> {
    fn from(value: SingleContestSelection) -> Self {
        let mut map = Self::new();
        // We only ever have one contest, so we unwrap the value created from 1u8.
        let index = ContestIndex::from_one_based_index_const(1).unwrap();
        let value = ContestSelection::new(
            value
                .0
                .into_iter()
                .map(ContestSelectionPlaintext::from)
                .collect(),
        )
        .expect("The input list is short enough for this to always be Some.");

        map.insert(index, value);
        map
    }
}

/// Get an encrypted ballot from a selection of candidates. The value returned
/// matches the ballot format expected by the election contract entrypoint for
/// registering ballots.
#[wasm_bindgen(js_name = "getEncryptedBallot")]
pub fn get_encrypted_ballot(
    selections: SingleContestSelection,
    context: EncryptedBallotContext,
    device_uuid: String,
) -> Result<js_sys::Uint8Array, JsError> {
    let pre_voting_data: PreVotingData = context.try_into()?;
    let device = Device::new(&device_uuid, pre_voting_data);

    let seed: [u8; 32] = thread_rng().gen();
    let mut csprng = Csprng::new(&seed);

    // Random is fine here, as we don't need to re-derive encryption of ballots
    let primary_nonce: [u8; 32] = thread_rng().gen();

    let ballot = BallotEncrypted::new_from_selections(
        BallotStyleIndex::from_one_based_index_unchecked(1),
        &device,
        &mut csprng,
        primary_nonce.as_ref(),
        &selections.into(),
    )?;

    let js_value = js_sys::Uint8Array::from(encode(&ballot)?.as_slice());
    Ok(js_value)
}
