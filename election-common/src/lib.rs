use std::collections::BTreeMap;

use eg::{
    ballot::BallotEncrypted,
    election_manifest::ContestIndex,
    guardian_public_key::GuardianPublicKey,
    guardian_share::GuardianEncryptedShare,
    joint_election_public_key::Ciphertext,
    verifiable_decryption::{DecryptionProofResponseShare, DecryptionShareResult},
};
use serde::{Deserialize, Serialize};

/// Deduplication of code to encode/decode serializable structs
pub trait ByteConvert
where
    Self: Serialize + Sized, {
    /// Encodes the value.
    ///
    /// ## Errors
    /// Fails if serialization fails
    fn encode(&self) -> Result<Vec<u8>, rmp_serde::encode::Error> { rmp_serde::to_vec(&self) }

    /// Attempts to decode the value
    ///
    /// ## Errors
    /// Fails if deserialization fails
    fn decode<'de>(value: &'de [u8]) -> Result<Self, rmp_serde::decode::Error>
    where
        Self: Deserialize<'de>, {
        rmp_serde::from_slice(value)
    }
}

pub type GuardianEncryptedShares = Vec<GuardianEncryptedShare>;
/// The representation of an encrypted tally of all contests in an election.
pub type ElectionEncryptedTally = BTreeMap<ContestIndex, Vec<Ciphertext>>;
/// The representation of a guardians decryption shares of the tally, i.e. one
/// [`DecryptionShareResult`] per [`Ciphertext`] included in the
/// [`ElectionEncryptedTally`]
pub type GuardianDecryptionShares = BTreeMap<ContestIndex, Vec<DecryptionShareResult>>;
/// The representation of a guardians response shares for the cummulative
/// election decryption, i.e. one [`DecryptionProofResponseShare`] per
/// [`Ciphertext`] included in the [`ElectionEncryptedTally`]
pub type GuardianDecryptionProofResponseShares =
    BTreeMap<ContestIndex, Vec<DecryptionProofResponseShare>>;

impl ByteConvert for GuardianPublicKey {}
impl ByteConvert for BallotEncrypted {}
impl ByteConvert for GuardianEncryptedShares {}
impl ByteConvert for ElectionEncryptedTally {}
impl ByteConvert for GuardianDecryptionShares {}
impl ByteConvert for GuardianDecryptionProofResponseShares {}
