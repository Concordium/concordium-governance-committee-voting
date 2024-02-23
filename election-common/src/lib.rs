use concordium_rust_sdk::smart_contracts::common::{AccountAddress, Amount};
use serde::{Deserialize, Serialize};

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

/// Represents a row in the eligible voters table written the csv file
/// containing the initial weights for each account
#[derive(serde::Serialize, serde::Deserialize)]
pub struct WeightRow {
    pub account: AccountAddress,
    pub amount:  Amount,
}
