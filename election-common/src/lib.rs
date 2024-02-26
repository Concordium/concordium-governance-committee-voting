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
#[cfg(feature = "full")]
#[derive(serde::Serialize, serde::Deserialize)]
pub struct WeightRow {
    pub account: concordium_rust_sdk::smart_contracts::common::AccountAddress,
    pub amount: concordium_rust_sdk::smart_contracts::common::Amount,
}

/// Get the scaling factor used to scale the encrypted ballots
#[cfg(feature = "full")]
pub fn get_scaling_factor(amount: &concordium_rust_sdk::smart_contracts::common::Amount) -> u64 {
    amount.micro_ccd() / 1_000_000u64
}
