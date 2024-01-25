use eg::{ballot::BallotEncrypted, guardian_public_key::GuardianPublicKey};
use serde::{de::DeserializeOwned, Serialize};

/// Deduplication of code to encode/decode serializable structs
pub trait ByteConvert
where
    Self: Serialize + DeserializeOwned + Sized, {
    /// Encodes the value.
    ///
    /// ## Errors
    /// Fails if serialization fails
    fn encode(&self) -> Result<Vec<u8>, rmp_serde::encode::Error> { rmp_serde::to_vec(&self) }

    /// Decodes the value
    ///
    /// ## Errors
    /// Fails if deserialization fails
    fn decode(value: Vec<u8>) -> Result<Self, rmp_serde::decode::Error> {
        rmp_serde::from_slice(&value)
    }
}

impl ByteConvert for GuardianPublicKey {}
impl ByteConvert for BallotEncrypted {}
