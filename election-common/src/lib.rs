use eg::{
    election_manifest::ContestIndex,
    joint_election_public_key::Ciphertext,
    verifiable_decryption::{
        DecryptionProofResponseShare, DecryptionProofStateShare, DecryptionShareResult,
    },
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// The representation of an encrypted tally of all contests in an election.
pub type ElectionEncryptedTally = BTreeMap<ContestIndex, Vec<Ciphertext>>;
/// The representation of a guardians decryption shares of the tally, i.e. one
/// [`DecryptionShareResult`] per [`Ciphertext`] included in the
/// [`ElectionEncryptedTally`]
pub type GuardianDecryptionShares = BTreeMap<ContestIndex, Vec<DecryptionShareResult>>;
/// The representation of the secret states for the commitment shares
/// corresponding to a list of [`eg::verifiable_decryption::DecryptionProof`]s
/// for a guardian
pub type GuardianDecryptionProofStateShares =
    BTreeMap<ContestIndex, Vec<DecryptionProofStateShare>>;
/// The representation of a guardians response shares for the cummulative
/// election decryption, i.e. one [`DecryptionProofResponseShare`] per
/// [`Ciphertext`] included in the [`ElectionEncryptedTally`]
pub type GuardianDecryptionProofResponseShares =
    BTreeMap<ContestIndex, Vec<DecryptionProofResponseShare>>;

/// Encodes the value.
///
/// ## Errors
/// Fails if serialization fails
pub fn encode<T: Serialize + Sized>(value: &T) -> Result<Vec<u8>, rmp_serde::encode::Error> {
    rmp_serde::to_vec(value)
}

/// Decodes the value
///
/// ## Errors
/// Fails if deserialization fails
pub fn decode<'de, T: Deserialize<'de>>(value: &'de [u8]) -> Result<T, rmp_serde::decode::Error> {
    rmp_serde::from_slice(value)
}