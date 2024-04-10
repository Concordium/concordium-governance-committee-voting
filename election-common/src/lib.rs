use anyhow::{ensure, Context};
use concordium_base::contracts_common::{AccountAddress, Amount};
use concordium_governance_committee_election::{ChecksumUrl, HashSha2256};
use eg::{
    election_manifest::ContestIndex,
    joint_election_public_key::Ciphertext,
    verifiable_decryption::{
        DecryptionProofResponseShare, DecryptionProofStateShare, DecryptionShareResult,
    },
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// The representation of an encrypted tally, i.e. one [`Ciphertext`] per
/// candidate.
pub type EncryptedTally = BTreeMap<ContestIndex, Vec<Ciphertext>>;
/// The representation of a guardians decryption shares of the tally, i.e. one
/// [`DecryptionShareResult`] per [`Ciphertext`] included in the
/// [`EncryptedTally`].
pub type GuardianDecryption = BTreeMap<ContestIndex, Vec<DecryptionShareResult>>;
/// The representation of the secret states for the commitment shares
/// corresponding to a list of [`eg::verifiable_decryption::DecryptionProof`]s
/// for a guardian.
pub type GuardianDecryptionProofState = BTreeMap<ContestIndex, Vec<DecryptionProofStateShare>>;
/// The representation of a guardians proofs of correct decryption for the
/// cummulative election decryption, i.e. one [`DecryptionProofResponseShare`]
/// per [`Ciphertext`] included in the [`EncryptedTally`].
pub type GuardianDecryptionProof = BTreeMap<ContestIndex, Vec<DecryptionProofResponseShare>>;

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

/// Get the scaling factor used to scale the encrypted ballots
pub fn get_scaling_factor(amount: &Amount) -> u64 { amount.micro_ccd() / 1_000_000u64 }

/// get the resource behind [`ChecksumUrl`] while checking the integrity of it.
pub async fn get_resource_checked(url: &ChecksumUrl) -> anyhow::Result<Vec<u8>> {
    use sha2::Digest;

    let response = reqwest::get(&url.url)
        .await
        .with_context(|| format!("Failed to get resource at {}", &url.url))?;
    ensure!(
        response.status().is_success(),
        "Failed to get resource at {}, server responded with {}",
        &url.url,
        response.status()
    );

    let data = response.bytes().await?;
    let hash = HashSha2256(sha2::Sha256::digest(&data).into());
    ensure!(
        hash == url.hash,
        "Failed to verify resource at {}, checksum mismatch (expected {}, computed {})",
        url.url,
        url.hash,
        hash
    );

    Ok(data.into())
}
