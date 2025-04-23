use anyhow::Context;
use concordium_governance_committee_election::{self as contract};
use concordium_rust_sdk::{
    common::encryption::Password,
    id::types::{AccountAddress, AccountKeys},
    types::WalletAccount,
};
use eg::{guardian::GuardianIndex, guardian_public_key::GuardianPublicKey};
use election_common::{decode, EncryptedTally};
use tokio::sync::Mutex;

use crate::{config::AppConfig, user_config::UserConfig};

/// The data stored for a guardian.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct GuardianData {
    /// The guardian account
    pub account: AccountAddress,
    /// The keys for the `account`
    pub keys:    AccountKeys,
    /// The guardian index used by election guard
    pub index:   GuardianIndex,
}

impl GuardianData {
    /// Create the guardian data from necessary data
    pub fn create(wallet_account: WalletAccount, index: GuardianIndex) -> Self {
        Self {
            account: wallet_account.address,
            keys: wallet_account.keys,
            index,
        }
    }
}

/// Holds the currently selected account and corresponding password
pub struct ActiveGuardian {
    /// The guardian data for the active account
    pub guardian: GuardianData,
    /// The password used for encryption with the selected account
    pub password: Password,
}

/// The type of managed state for the active guardian. This is set as the user
/// either imports or loads an account.
#[derive(Default)]
pub struct ActiveGuardianState(pub Mutex<Option<ActiveGuardian>>);

/// The data registered in the election contract
#[derive(Default)]
pub struct ContractData {
    /// The guardians state registered in the election contract
    pub guardians:       contract::GuardiansState,
    /// The encrypted tally registered in the contract
    pub encrypted_tally: Option<EncryptedTally>,
}

impl ContractData {
    /// Parse the public keys of all guardians in the [`ContractData`],
    /// returning an error if any public key is missing or not parsable.
    pub fn guardian_public_keys(&self) -> anyhow::Result<Vec<GuardianPublicKey>> {
        self.guardians
            .iter()
            .map(|(acc, g)| {
                let public_key = g.public_key.as_ref().with_context(|| {
                    format!("Public key registration missing for guardian with account {acc}")
                })?;
                let public_key = decode(public_key).with_context(|| {
                    format!("Failed to decode public key for guardian with account {acc}")
                })?;
                Ok(public_key)
            })
            .collect()
    }
}

/// The state read from the election contract
#[derive(Default)]
pub struct ContractDataState(pub Mutex<ContractData>);

/// The application config state
pub struct AppConfigState(pub Mutex<AppConfig>);

impl From<UserConfig> for AppConfigState {
    fn from(config: UserConfig) -> Self { Self(Mutex::new(config.into())) }
}
