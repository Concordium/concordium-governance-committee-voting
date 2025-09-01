use std::{path::PathBuf, str::FromStr};

use concordium_rust_sdk::{
    base::{contracts_common, hashes::BlockHash},
    contract_client::ContractUpdateError,
    id::types::AccountAddress,
    types::RejectReason,
    v2,
    web3id::did::Network,
};
use serde::ser::SerializeStruct;

/// Formats a [`QueryError`] for the frontend.
fn get_error_message(error: &v2::QueryError) -> String {
    match error {
        // Get the status message of an RPC error.
        v2::QueryError::RPCError(v2::RPCError::CallError(status)) => status.message().to_string(),
        _ => format!("{error}"),
    }
}

/// Describes any error happening in the backend.
#[derive(thiserror::Error, Debug, strum::IntoStaticStr)]
pub enum Error {
    /// HTTP error when trying to get remote resource
    #[error("Failed to get election configuration from server")]
    Http(#[from] reqwest::Error),
    /// Decryption of file contents failed. This can either indicate incorrect
    /// password given by the user, or file corruption.
    #[error("Decryption of data failed")]
    DecryptionFailed,
    /// IO error while attempting read/write
    #[error("{0}")]
    IO(#[from] std::io::Error),
    /// Could not deserialize contents of the encrypted file. This will not be
    /// due to invalid user input.
    #[error("File corruption detected for {0}")]
    Corrupted(PathBuf),
    /// Internal errors.
    #[error("Internal error: {0:?}")]
    Internal(#[from] anyhow::Error),
    /// Could not connect to node
    #[error("Failed to connect to concordium node")]
    NodeConnection(#[from] tonic::transport::Error),
    /// Query was rejected by the node
    #[error("Node rejected with reason: {0:#?}")]
    QueryFailed(RejectReason),
    /// An error happened while querying the node
    #[error("Query error: {}", get_error_message(.0))]
    Network(#[from] v2::QueryError),
    /// Duplicate account found when importing
    #[error("Account has already been imported")]
    ExistingAccount,
    /// Used to abort an interactive command invocation prematurely (i.e. where
    /// the command awaits events emitted by the frontend)
    #[error("Interaction aborted by the user")]
    AbortInteraction,
    /// Failed to validate either the [`GuardianPublicKey`] or the
    /// [`GuardianEncryptedShare`]s submitted by the guardian represented by
    /// the inner [`AccountAddress`]
    #[error("Failed to validate peer submissions")]
    PeerValidation(Vec<AccountAddress>),
    /// When a decryption share result shared by some guardian is invalid
    #[error("{0} - manual intervention required by the election coordinator")]
    InvalidDecryptionShare(String),
    #[error("The user configuration is incomplete. The '{0}' field is missing.")]
    IncompleteConfiguration(String),
    #[error("The configuration is invalid: {0}")]
    InvalidConfiguration(String),
    #[error("The user configuration is corrupt ({0})")]
    CorruptedConfig(String),
}

impl From<toml_edit::de::Error> for Error {
    fn from(error: toml_edit::de::Error) -> Self {
        Error::CorruptedConfig(error.to_string())
    }
}

impl From<toml_edit::TomlError> for Error {
    fn from(error: toml_edit::TomlError) -> Self {
        Error::CorruptedConfig(error.to_string())
    }
}

impl From<contracts_common::NewReceiveNameError> for Error {
    /// Maps to internal error as this receive names of contract entrypoints are
    /// declared statically.
    fn from(error: contracts_common::NewReceiveNameError) -> Self {
        anyhow::Error::new(error)
            .context("Invalid receive name")
            .into()
    }
}

impl From<contracts_common::ParseError> for Error {
    /// Maps to internal error as we can assume to be able to always parse
    /// contract responses.
    fn from(error: contracts_common::ParseError) -> Self {
        anyhow::Error::new(error)
            .context("Contract response could not be parsed")
            .into()
    }
}

impl From<contracts_common::ExceedsParameterSize> for Error {
    /// Maps to internal error as we know the size of the parameters provided to
    /// the contract in advance.
    fn from(error: contracts_common::ExceedsParameterSize) -> Self {
        anyhow::Error::new(error)
            .context("Parameter supplied to entrypoint was too big")
            .into()
    }
}

impl From<RejectReason> for Error {
    fn from(reason: RejectReason) -> Self {
        Error::QueryFailed(reason)
    }
}

impl From<ContractUpdateError> for Error {
    fn from(error: ContractUpdateError) -> Self {
        match error {
            ContractUpdateError::Query(inner) => inner.into(),
            ContractUpdateError::Failed(inner) => inner.into(),
        }
    }
}

// Needs Serialize to be able to return it from a command
impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut error = serializer.serialize_struct("Error", 2)?;
        error.serialize_field("type", <&str>::from(self))?;
        error.serialize_field("message", &self.to_string())?;
        error.end()
    }
}

/// The genesis hash of testnet
pub const TESTNET_GENESIS_HASH: &str =
    "4221332d34e1694168c2a0c0b3fd0f273809612cb13d000d5c2e00e85f50f796";
/// The genesis hash of mainnet
pub const MAINNET_GENESIS_HASH: &str =
    "9dd9ca4d19e9393877d2c44b70f89acbfc0883c2243e5eeaecc0d1cd0503f478";

pub trait GenesisHash {
    fn genesis_hash(&self) -> BlockHash;
}

impl GenesisHash for Network {
    fn genesis_hash(&self) -> BlockHash {
        match self {
            Self::Testnet => BlockHash::from_str(TESTNET_GENESIS_HASH).unwrap(),
            Self::Mainnet => BlockHash::from_str(MAINNET_GENESIS_HASH).unwrap(),
        }
    }
}

/// The default request timeout to use if not specified by environment variable
/// "CCD_ELECTION_REQUEST_TIMEOUT_MS".
pub const DEFAULT_REQUEST_TIMEOUT_MS: u16 = 10000;
