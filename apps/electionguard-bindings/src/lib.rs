mod utils;

use std::{collections::BTreeMap, convert::TryFrom};

use eg::{
    ballot::BallotEncrypted,
    contest_selection::ContestSelection,
    device::Device,
    election_manifest::{ContestIndex, ElectionManifest},
    election_parameters::ElectionParameters,
    election_record::PreVotingData,
    guardian_public_key::GuardianPublicKey,
    hashes::Hashes,
    hashes_ext::HashesExt,
    joint_election_public_key::JointElectionPublicKey,
};
use serde::{Deserialize, Serialize};
use util::csprng::Csprng;
use tsify::Tsify;

use utils::set_panic_hook;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(typescript_custom_section)]
const TS_APPEND_CONTENT: &'static str = r#"
export type ElectionManifest = any;
export type ElectionParameters = any;
export type GuardianPublicKey = any;
"#;

/// The contextual parameters necessary to generate the encrypted ballot
#[derive(Debug, Serialize, Deserialize, Clone, Tsify)]
#[tsify(from_wasm_abi)]
pub struct EncryptedBallotContext {
    /// The election manifest. This should be declared externally for each election.
    pub election_manifest: ElectionManifest,
    /// The election parameters. These should be generated externally for each election.
    // TODO: is the assumption above correct?
    pub election_parameters: ElectionParameters,
    /// The guardian public keys, which are registered in the election contract.
    pub guardian_public_keys: Vec<GuardianPublicKey>,
}

impl TryFrom<EncryptedBallotContext> for PreVotingData {
    type Error = JsError;

    fn try_from(value: EncryptedBallotContext) -> Result<Self, Self::Error> {
        let joint_election_public_key = JointElectionPublicKey::compute(
            &value.election_parameters,
            value.guardian_public_keys.as_slice(),
        )
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
            value.guardian_public_keys.as_slice(),
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

impl TryFrom<&EncryptedBallotContext> for PreVotingData {
    type Error = JsError;

    fn try_from(value: &EncryptedBallotContext) -> Result<Self, Self::Error> {
        let value = value.clone();
        value.try_into()
    }
}

#[derive(Debug, Serialize, Deserialize, Tsify)]
#[tsify(from_wasm_abi)]
pub struct SingleContestSelection(pub Vec<bool>);

impl Into<BTreeMap<ContestIndex, ContestSelection>> for SingleContestSelection {
    fn into(self) -> BTreeMap<ContestIndex, ContestSelection> {
        let mut map = BTreeMap::new();
        // We only ever have one contest, so we unwrapping value created from 1u8.
        let index = ContestIndex::from_one_based_index_const(1).unwrap();
        let value = ContestSelection {
            vote: self.0.clone().into_iter().map(|v| v.into()).collect(),
        };

        map.insert(index, value);
        map
    }
}

/// Get an encrypted ballot from a selection of candidates. The value returned matches the ballot
/// format expected by the election contract entrypoint for registering ballots.
#[wasm_bindgen(js_name = "getEncryptedBallot")]
pub fn get_encrypted_ballot(selections: SingleContestSelection, context: EncryptedBallotContext) -> Result<JsValue, JsError> {
    set_panic_hook(); // for debugging

    let pre_voting_data: PreVotingData = context.try_into()?;
    let device = Device::new("Test", pre_voting_data);

    let seed = vec![0, 1, 2, 3]; // TODO: what should we use for this?
    let mut csprng = Csprng::new(&seed);

    let mut primary_nonce = [0u8; 32];
    // Random is fine as we don't need to re-derive encryption of ballots
    // TODO: is the assumption above correct?
    (0..32).for_each(|i| primary_nonce[i] = csprng.next_u8());

    let ballot = BallotEncrypted::new_from_selections(
        &device,
        &mut csprng,
        primary_nonce.as_ref(),
        &selections.into(),
    );
    let value = serde_wasm_bindgen::to_value(&ballot)?;
    Ok(value)
}
