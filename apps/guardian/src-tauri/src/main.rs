// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::{anyhow, Context};
use concordium_governance_committee_election::{
    self as contract, ChecksumUrl, ElectionConfig, HashSha2256,
};
use concordium_rust_sdk::{
    common::encryption::{decrypt, encrypt, EncryptedData, Password},
    contract_client::{ContractClient, ContractUpdateError},
    id::types::AccountKeys,
    smart_contracts::common::{self as contracts_common, AccountAddress, Amount},
    types::{
        smart_contracts::OwnedParameter, ContractAddress, Energy, RejectReason, WalletAccount,
    },
    v2::{self, BlockIdentifier, Client, Endpoint, QueryError},
};
use eg::{
    election_manifest::ElectionManifest,
    election_parameters::ElectionParameters,
    guardian::GuardianIndex,
    guardian_public_key::GuardianPublicKey,
    guardian_secret_key::GuardianSecretKey,
    guardian_share::{GuardianEncryptedShare, GuardianSecretKeyShare},
};
use election_common::{decode, encode};
use rand::{thread_rng, Rng};
use serde::{de::DeserializeOwned, ser::SerializeStruct, Serialize};
use sha2::Digest;
use std::{
    path::{Path, PathBuf},
    str::FromStr,
    time::Duration,
};
use tauri::{App, AppHandle, Manager, State, Window};
use tokio::sync::Mutex;
use tonic::transport::ClientTlsConfig;
use util::csprng::Csprng;

/// The file name of the encrypted wallet account.
const WALLET_ACCOUNT_FILE: &str = "guardian-data.json.aes";
/// The file name of the encrypted secret key for a guardian.
const SECRET_KEY_FILE: &str = "secret-key.json.aes";
/// The file name of the encrypted secret share for a guardian.
const SECRET_SHARE_FILE: &str = "secret-share.json.aes";

/// The default request timeout to use if not specified by environment variable
/// "CCD_ELECTION_REQUEST_TIMEOUT_MS".
const DEFAULT_REQUEST_TIMEOUT_MS: u16 = 5000;

/// Describes any error happening in the backend.
#[derive(thiserror::Error, Debug, strum::IntoStaticStr)]
enum Error {
    /// HTTP error when trying to get remote resource
    #[error("Failed to get remote resource: {0}")]
    Http(#[from] reqwest::Error),
    /// Decryption of file contents failed. This can either indicate incorrect
    /// password given by the user, or file corruption.
    #[error("Decryption of data failed")]
    DecryptionError,
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
    #[error("Failed to connect to concordium node: {0}")]
    NodeConnection(#[from] tonic::transport::Error),
    /// Query was rejected by the node
    #[error("Node rejected with reason: {0:#?}")]
    QueryFailed(RejectReason),
    /// A network error happened while querying the node
    #[error("Network error: {0}")]
    NetworkError(#[from] QueryError),
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
    fn from(reason: RejectReason) -> Self { Error::QueryFailed(reason) }
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
        S: serde::Serializer, {
        let mut error = serializer.serialize_struct("Error", 2)?;
        error.serialize_field("type", <&str>::from(self))?;
        error.serialize_field("message", &self.to_string())?;
        error.end()
    }
}

/// The data stored for a guardian.
#[derive(serde::Serialize, serde::Deserialize)]
struct GuardianData {
    /// The guardian account
    account: AccountAddress,
    /// The keys for the `account`
    keys:    AccountKeys,
    /// The guardian index used by election guard
    index:   GuardianIndex,
}

impl GuardianData {
    /// Create the guardian data from necessary data
    fn create(wallet_account: WalletAccount, index: GuardianIndex) -> Self {
        Self {
            account: wallet_account.address,
            keys: wallet_account.keys,
            index,
        }
    }
}

/// Holds the currently selected account and corresponding password
struct ActiveGuardian {
    /// The guardian data for the active account
    guardian: GuardianData,
    /// The password used for encryption with the selected account
    password: Password,
}

/// The type of managed state for the active guardian. This is set as the user
/// either imports or loads an account.
#[derive(Default)]
struct ActiveGuardianState(Mutex<Option<ActiveGuardian>>);

/// The collective state kept for all guardians
#[derive(Default)]
struct GuardiansState(Mutex<contract::GuardiansState>);

/// The necessary election guard configuration to construct election guard
/// entities.
#[derive(Clone)]
struct ElectionGuardConfig {
    /// The election manifest
    #[allow(dead_code)] // TODO: remove when it is used
    manifest: ElectionManifest,
    /// The election parameters
    parameters: ElectionParameters,
}

struct ElectionContractMarker;
/// The election contract client
type ElectionClient = ContractClient<ElectionContractMarker>;

/// Wrapper around [`reqwest::Client`] to provide
/// `HttpClient::get_resource_checked`
#[derive(Debug, Clone)]
struct HttpClient(reqwest::Client);

impl HttpClient {
    /// Gets the remote resource at `url` while also checking the content
    /// against the checksum included as part of the [`ChecksumUrl`]
    async fn get_resource_checked<J: DeserializeOwned>(
        &self,
        url: &ChecksumUrl,
    ) -> Result<J, Error> {
        let data = self.0.get(url.url.clone()).send().await?.bytes().await?;
        let hash = HashSha2256(sha2::Sha256::digest(&data).into());
        if url.hash != hash {
            return Err(anyhow!(
                "Verification of remote resource at {} failed. Expected checksum {} did not match \
                 computed hash {}.",
                url.url,
                url.hash,
                hash
            )
            .into());
        }

        let result = serde_json::from_slice(&data)
            .with_context(|| format!("Failed to deserialize data at {}", url.url))?;
        Ok(result)
    }
}

/// The contract (and correspondingly node) connection configuration.
#[derive(Clone)]
struct ConnectionConfig {
    /// The http client to use for remote resources
    http:     HttpClient,
    /// The contract client for querying the contract.
    contract: ElectionClient,
}

impl ConnectionConfig {
    /// Creates a connection to a concordium node and a contract client. This
    /// function panics if the necessary environment variables are not set.
    async fn try_create_from_env() -> Result<Self, Error> {
        let endpoint = Endpoint::from_str(env!("CCD_ELECTION_NODE"))
            .expect("Could not parse CCD_ELECTION_NODE");
        let timeout = option_env!("CCD_ELECTION_REQUEST_TIMEOUT_MS")
            .map(|v| u64::from_str(v).expect("Could not parse CCD_ELECTION_REQUEST_TIMEOUT_MS"))
            .unwrap_or(DEFAULT_REQUEST_TIMEOUT_MS.into());
        let timeout = Duration::from_millis(timeout);
        let contract_address = ContractAddress::from_str(env!("CCD_ELECTION_CONTRACT_ADDRESS"))
            .expect("Could not parse CCD_ELECTION_CONTRACT_ADDRESS");

        let endpoint = if endpoint
            .uri()
            .scheme()
            .map_or(false, |x| x == &v2::Scheme::HTTPS)
        {
            endpoint
                .tls_config(ClientTlsConfig::new())
                .context("Unable to construct TLS configuration for Concordium API.")?
        } else {
            endpoint
        };
        let endpoint = endpoint.connect_timeout(timeout).timeout(timeout);
        let node = Client::new(endpoint).await?;
        let contract = ElectionClient::create(node, contract_address).await?;

        let http = reqwest::Client::builder()
            .connect_timeout(timeout)
            .timeout(timeout)
            .build()?;
        let http = HttpClient(http);

        let contract_connection = Self { contract, http };
        Ok(contract_connection)
    }

    /// Gets the election config from the contract and subsequently the election
    /// guard config.
    async fn try_get_election_config(
        &mut self,
    ) -> Result<(ElectionConfig, ElectionGuardConfig), Error> {
        let config: ElectionConfig = self
            .contract
            .view::<OwnedParameter, ElectionConfig, Error>(
                "viewConfig",
                &OwnedParameter::empty(),
                BlockIdentifier::LastFinal,
            )
            .await?;
        let manifest: ElectionManifest = self
            .http
            .get_resource_checked(&config.election_manifest)
            .await?;
        let parameters: ElectionParameters = self
            .http
            .get_resource_checked(&config.election_parameters)
            .await?;

        let eg_config = ElectionGuardConfig {
            manifest,
            parameters,
        };
        Ok((config, eg_config))
    }
}

/// The application config necessary for the application to function. All fields
/// are optional to allow initializing the application with an "empty" version
/// of this.
#[derive(Default, Clone)]
struct AppConfig {
    /// The connection to the contract. Best to access this through
    /// [`AppConfig::connection`] as this lazily creates the connection and
    /// caches it.
    connection:     Option<ConnectionConfig>,
    /// The election config registered in the contract. Best to access this
    /// through [`AppConfig::election`] as this lazily loads the
    /// election config and caches it.
    election:       Option<ElectionConfig>,
    /// The election guard config. Best to access this through
    /// [`AppConfig::election_guard`] as this lazily loads the
    /// election guard config and caches it.
    election_guard: Option<ElectionGuardConfig>,
}

impl AppConfig {
    /// Gets the connection. If a connection does not exist, a new one is
    /// created and stored in the configuration before being returned.
    async fn connection(&mut self) -> Result<ConnectionConfig, Error> {
        let connection = if let Some(connection) = &self.connection {
            connection.clone()
        } else {
            let connection = ConnectionConfig::try_create_from_env().await?;
            self.connection = Some(connection.clone());
            connection
        };

        Ok(connection)
    }

    /// Gets the election guard config. If not already present, it is fetched
    /// and stored (along with the election config) before being returned.
    async fn election_guard(&mut self) -> Result<ElectionGuardConfig, Error> {
        let eg = if let Some(eg) = &self.election_guard {
            eg.clone()
        } else {
            let mut connection = self.connection().await?;
            let (election, eg) = connection.try_get_election_config().await?;

            self.election_guard = Some(eg.clone());
            self.election = Some(election);

            eg
        };

        Ok(eg)
    }

    /// Gets the election guard. If not already present, it is fetched and
    /// stored (along with the election guard config) before being returned.
    async fn election(&mut self) -> Result<ElectionConfig, Error> {
        let election = if let Some(election) = &self.election {
            election.clone()
        } else {
            let mut connection = self.connection().await?;
            let (election, eg) = connection.try_get_election_config().await?;

            self.election_guard = Some(eg);
            self.election = Some(election.clone());

            election
        };

        Ok(election)
    }
}

/// The application config state
#[derive(Default)]
struct AppConfigState(Mutex<AppConfig>);

/// Stores the account in global state.
async fn use_guardian<'a>(
    guardian: GuardianData,
    password: Password,
    state: &State<'a, ActiveGuardianState>,
) {
    let mut active_account = state.0.lock().await;
    *active_account = Some(ActiveGuardian { guardian, password });
}

/// Get the data directory for a guardian account
fn guardian_data_dir(app_handle: &AppHandle, account: AccountAddress) -> PathBuf {
    app_handle
        .path_resolver()
        .app_data_dir()
        .unwrap() // Path is available as declared in `tauri.conf.json`
        .join(account.to_string())
}

/// Writes `data` encrypted with `password` to disk
fn write_encrypted_file<D: serde::Serialize>(
    password: &Password,
    data: &D,
    file_path: &Path,
) -> Result<(), Error> {
    let plaintext = serde_json::to_string(&data).context("Failed to serialize data")?;
    let mut rng = thread_rng();
    // Serialization will not fail at this point.
    let encrypted_data = serde_json::to_vec(&encrypt(password, &plaintext, &mut rng)).unwrap();
    std::fs::write(file_path, encrypted_data)?;

    Ok(())
}

/// Deserialize contents of an encrypted file.
fn read_encrypted_file<D: serde::de::DeserializeOwned>(
    password: &Password,
    file_path: &PathBuf,
) -> Result<D, Error> {
    let encrypted_bytes = std::fs::read(file_path)?;
    let encrypted: EncryptedData = serde_json::from_slice(&encrypted_bytes)
        .map_err(|_| Error::Corrupted(file_path.clone()))?;

    let decrypted_bytes = decrypt(password, &encrypted).map_err(|_| Error::DecryptionError)?;
    let value = serde_json::from_slice(&decrypted_bytes).map_err(|_| Error::DecryptionError)?;
    Ok(value)
}

/// Handle a wallet import. Creates a directory for storing data associated with
/// the guardian account and returns the [`AccountAddress`] of the imported
/// wallet account.
///
/// This will create the data directory for the app if it does not already
/// exist.
///
/// ## Errors
/// Fails if the account has already been imported or if the guardian data could
/// not be written to disk (which should not happen).
#[tauri::command]
async fn import_wallet_account(
    wallet_account: WalletAccount,
    guardian_index: GuardianIndex,
    password: String,
    active_guardian_state: State<'_, ActiveGuardianState>,
    app_handle: AppHandle,
) -> Result<AccountAddress, Error> {
    let account = wallet_account.address;

    let guardian_dir = guardian_data_dir(&app_handle, account);
    if guardian_dir.exists() {
        return Err(Error::ExistingAccount);
    }
    std::fs::create_dir(&guardian_dir)?;

    let password = Password::from(password);
    let guardian_data = GuardianData::create(wallet_account, guardian_index);
    let account_address = guardian_data.account;
    write_encrypted_file(
        &password,
        &guardian_data,
        &guardian_dir.join(WALLET_ACCOUNT_FILE),
    )?;
    use_guardian(guardian_data, password, &active_guardian_state).await;

    Ok(account_address)
}

/// Gets the accounts which have previously been imported into the application.
///
/// ## Errors
/// Fails if the appliction data directory could not be read, which should not
/// happen due to ensuring the existence during application setup.
#[tauri::command(async)]
fn get_accounts(handle: AppHandle) -> Result<Vec<AccountAddress>, Error> {
    let app_data_dir = handle.path_resolver().app_data_dir().unwrap();
    let entries = std::fs::read_dir(app_data_dir)?;

    let accounts: Vec<_> = entries
        .into_iter()
        .filter_map(|entry| {
            let path = entry.ok()?.path();
            if path.is_file() {
                return None;
            }

            let folder_str = path.file_name()?.to_str()?;
            AccountAddress::from_str(folder_str).ok()
        })
        .collect();

    Ok(accounts)
}

/// Load a [`GuardianAccount`] from disk, decrypting the contents with
/// `password`
///
/// ## Errors
/// - [`Error::DecryptionError`]
#[tauri::command]
async fn load_account(
    account: AccountAddress,
    password: String,
    app_handle: AppHandle,
    active_guardian_state: State<'_, ActiveGuardianState>,
) -> Result<(), Error> {
    let password = Password::from(password);
    let account_path = guardian_data_dir(&app_handle, account).join(WALLET_ACCOUNT_FILE);
    let guardian_data: GuardianData = read_encrypted_file(&password, &account_path)?;
    use_guardian(guardian_data, password, &active_guardian_state).await;

    Ok(())
}

/// Generate a key pair for the selected guardian, storing the secret key on
/// disk and returning the public key. If the secret key already exists, it
/// returns the corresponding public key.
///
/// ## Errors
/// Any errors happening will be due to data corruption or internal errors.
async fn generate_key_pair<'a>(
    active_guardian_state: &State<'a, ActiveGuardianState>,
    app_config: &State<'a, AppConfigState>,
    app_handle: AppHandle,
) -> Result<GuardianPublicKey, Error> {
    let active_guardian_guard = active_guardian_state.0.lock().await;
    let active_guardian = active_guardian_guard
        .as_ref()
        .ok_or(anyhow!("Active account not set"))?;
    let account = active_guardian.guardian.account;
    let secret_key_path = guardian_data_dir(&app_handle, account).join(SECRET_KEY_FILE);

    let secret_key = if secret_key_path.exists() {
        read_encrypted_file(&active_guardian.password, &secret_key_path)?
    } else {
        let mut app_config_guard = app_config.0.lock().await;
        let app_config = app_config_guard.election_guard().await?;
        let seed: [u8; 32] = thread_rng().gen();
        let mut csprng = Csprng::new(&seed);
        let secret_key = GuardianSecretKey::generate(
            &mut csprng,
            &app_config.parameters,
            active_guardian.guardian.index,
            account.to_string().into(),
        );
        write_encrypted_file(&active_guardian.password, &secret_key, &secret_key_path)?;
        secret_key
    };

    let public_key = secret_key.make_public_key();
    Ok(public_key)
}

/// Sends a message to the current [`Window`] and waits for a response. Uses the
/// supplied `id` as the event channel.
async fn send_message<M, R>(
    window: &Window,
    id: &str,
    message: M,
) -> Result<Option<R>, serde_json::Error>
where
    M: Serialize + Clone,
    R: DeserializeOwned + Sync + Send + 'static, {
    // Construct the message channel and setup response listener
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window.once(id, move |e| {
        let response: Result<Option<R>, _> = e.payload().map(serde_json::from_str).transpose();
        let _ = sender.send(response); // Receiver will not be dropped
    });

    // Send the message
    let _ = window.emit(id, message);

    // Wait for the response
    receiver.await.unwrap() // Sender will not be dropped.
}

/// Submit a request for approval to the frontend, waiting for response. Only
/// accepts `true` as the response from the frontend; any other response will
/// result in an error.
async fn wait_for_approval<M: Serialize + Clone>(
    channel_id: &str,
    window: &Window,
    proposal: M,
) -> Result<(), Error> {
    match send_message(window, channel_id, proposal).await {
        Ok(Some(true)) => Ok(()), // Transaction estimate approved
        Ok(Some(false)) => Err(Error::AbortInteraction), // Transaction estimate rejected
        Ok(None) => {
            Err(anyhow!("Expected a boolean value from the frontend, but received none").into())
        }
        Err(error) => Err(anyhow::Error::new(error)
            .context("Unexpected result received from the frontend, expected boolean value")
            .into()),
    }
}

async fn handle_abort(channel_id: &str, window: &Window) -> Error {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    window.once(format!("{}::ABORT", &channel_id), move |_| {
        let _ = sender.send(()); // Receiver will not be dropped
    });

    receiver.await.unwrap(); // Sender will not be dropped.
    Error::AbortInteraction
}

/// This command executes the following steps:
///
/// - Generate a key pair, storing the secret key (encrypted) on disk
/// - Request transaction fee estimate approval from user
/// - Register guardian public key in the election contract
///
/// ## Errors
/// Expected errors include:
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
/// - [`Error::QueryFailed`]
#[tauri::command]
async fn register_guardian_key_flow<'a>(
    channel_id: String,
    active_guardian_state: State<'a, ActiveGuardianState>,
    app_config_state: State<'a, AppConfigState>,
    app_handle: AppHandle,
    window: Window,
) -> Result<(), Error> {
    let cancel = handle_abort(&channel_id, &window);

    let interaction = async {
        let public_key =
            generate_key_pair(&active_guardian_state, &app_config_state, app_handle).await?;
        let mut contract = app_config_state.0.lock().await.connection().await?.contract;
        let active_guardian_guard = active_guardian_state.0.lock().await;
        let active_guardian = active_guardian_guard
            .as_ref()
            .context("Active account not set")?;
        let result = contract
            .dry_run_update::<Vec<u8>, Error>(
                "registerGuardianPublicKey",
                Amount::zero(),
                active_guardian.guardian.account,
                &encode(&public_key).unwrap(), // Serialization will not fail
            )
            .await?;

        // Wait for response from the user through the frontend
        wait_for_approval(&channel_id, &window, result.current_energy()).await?;

        result
            .send(&active_guardian.guardian.keys)
            .await?
            .wait_for_finalization()
            .await?;

        Ok(())
    };

    tokio::select! {
        error = cancel => Err(error),
        res = interaction => res
    }
}

/// Generate the encrypted shares for the active guardian. This is done by
/// querying the public keys registered by all guardians, and generating
/// [`GuardianEncryptedShare`] for each of them.
///
/// ## Errors
/// Expected errors include:
/// - [`Error::NodeConnection`]
/// - [`Error::PeerValidation`]
async fn generate_encrypted_shares<'a>(
    active_guardian_state: &State<'a, ActiveGuardianState>,
    app_config_state: &State<'a, AppConfigState>,
    app_handle: &AppHandle,
) -> Result<Vec<GuardianEncryptedShare>, Error> {
    let active_guardian = active_guardian_state.0.lock().await;
    let Some(active_guardian) = active_guardian.as_ref() else {
        return Err(Error::Internal(anyhow!(
            "Expected active guardian state to be set"
        )));
    };

    let secret_key_path =
        guardian_data_dir(app_handle, active_guardian.guardian.account).join(SECRET_KEY_FILE);
    let secret_key = read_encrypted_file(&active_guardian.password, &secret_key_path)?;

    let mut app_config = app_config_state.0.lock().await;
    let mut contract = app_config.connection().await?.contract;
    let election_parameters = app_config.election_guard().await?.parameters;
    let guardians_state = contract
        .view::<_, contract::GuardiansState, Error>(
            "viewGuardiansState",
            &(),
            BlockIdentifier::LastFinal,
        )
        .await?;
    let validation_results = guardians_state
        .iter()
        .map(|(acc, gs)| {
            gs.public_key
                .as_ref()
                .with_context(|| format!("Public key not found for guardian with account {}", acc))
                .map_err(Error::from)
                .map(|pub_key| {
                    // Attempt to decode the public key. Failure to do so means the key submitted by
                    // that guardian is invalid, and should be reported to the
                    // election contract.
                    decode::<GuardianPublicKey>(pub_key).map_err(|_| *acc)
                })
        })
        .collect::<Result<Vec<_>, Error>>()?;

    let (guardian_public_keys, invalid_submissions) =
        validation_results
            .into_iter()
            .fold((vec![], vec![]), |mut acc, res| {
                match res {
                    Ok(key) => acc.0.push(key),
                    Err(account) => acc.1.push(account),
                };
                acc
            });

    if !invalid_submissions.is_empty() {
        return Err(Error::PeerValidation(invalid_submissions));
    }

    let mut rng = Csprng::new(&thread_rng().gen::<[u8; 32]>());
    let encrypted_shares: Vec<_> = guardian_public_keys
        .into_iter()
        .map(|recipient_public_key| {
            GuardianEncryptedShare::new(
                &mut rng,
                &election_parameters,
                &secret_key,
                &recipient_public_key,
            )
        })
        .collect();
    Ok(encrypted_shares)
}

/// Different possible branches of the flow for registering encrypted shares
#[derive(Debug, strum::IntoStaticStr, Clone)]
enum ValidatedProposal {
    /// All peer entities were successfully validated
    Success(Amount),
    /// Validation of some keys of guardian accounts failed
    Complaint(Amount),
}

impl ValidatedProposal {
    fn ccd_cost(&self) -> Amount {
        match self {
            Self::Success(amount) => *amount,
            Self::Complaint(amount) => *amount,
        }
    }
}

impl Serialize for ValidatedProposal {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
        let mut error = serializer.serialize_struct("ValidatedProposal", 2)?;
        error.serialize_field("type", <&str>::from(self))?;
        error.serialize_field("ccdCost", &self.ccd_cost())?;
        error.end()
    }
}

/// Runs the flow for computing and registering [`GuardianEncryptedShare`]s in
/// the election contract. This has two potential outcomes:
/// 1. All peer public keys are valid, the shares are computed and registered in
/// the election contract.
/// 2. One or more invalid keys have been detected, a complaint with the
/// associated guardian accounts is registered in    the election contract.
///
/// The following steps are run:
/// 1. Validate peer keys + generate encrypted shares if successful
/// 2. Request approval of transaction proposal (either registration of shares
/// or complaint) 3. Transaction submission + await finalization.
///
/// ## Errors
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
/// - [`Error::QueryFailed`]
#[tauri::command]
async fn register_guardian_shares_flow<'a>(
    channel_id: String,
    active_guardian_state: State<'a, ActiveGuardianState>,
    app_config_state: State<'a, AppConfigState>,
    app_handle: AppHandle,
    window: Window,
) -> Result<(), Error> {
    let cancel = handle_abort(&channel_id, &window);
    let interaction = async {
        let encrypted_shares =
            match generate_encrypted_shares(&active_guardian_state, &app_config_state, &app_handle)
                .await
            {
                Ok(shares) => Ok(shares),
                Err(Error::PeerValidation(accounts)) => Err(accounts),
                Err(error) => return Err(error),
            };

        let mut contract = app_config_state.0.lock().await.connection().await?.contract;
        let active_guardian_guard = active_guardian_state.0.lock().await;
        let active_guardian = active_guardian_guard
            .as_ref()
            .context("Active account not set")?;

        // Depending on whether any validation failures are detected, either:
        // 1. register the generated shares
        // 2. file a complaint with the guardian accounts with invalid key registrations
        let (proposal, contract_update) = match encrypted_shares {
            Ok(encrypted_shares) => {
                let update = contract
                    .dry_run_update::<Vec<u8>, Error>(
                        "registerGuardianEncryptedShare",
                        Amount::zero(),
                        active_guardian.guardian.account,
                        &encode(&encrypted_shares).unwrap(), // Serialization will not fail
                    )
                    .await?;

                let ccd_cost = energy_to_ccd(update.current_energy(), &app_config_state).await?;
                let proposal = ValidatedProposal::Success(ccd_cost);
                (proposal, update)
            }
            Err(accounts) => {
                let update = contract
                    .dry_run_update::<contract::GuardianStatus, Error>(
                        "registerGuardianStatus",
                        Amount::zero(),
                        active_guardian.guardian.account,
                        &contract::GuardianStatus::KeyVerificationFailed(accounts), // Serialization will not fail
                    )
                    .await?;
                let ccd_cost = energy_to_ccd(update.current_energy(), &app_config_state).await?;
                let proposal = ValidatedProposal::Complaint(ccd_cost);
                (proposal, update)
            }
        };

        // Wait for response from the user through the frontend
        wait_for_approval(&channel_id, &window, proposal).await?;

        contract_update
            .send(&active_guardian.guardian.keys)
            .await?
            .wait_for_finalization()
            .await?;

        Ok(())
    };

    tokio::select! {
        error = cancel => Err(error),
        res = interaction => res
    }
}

async fn generate_secret_share<'a>(
    active_guardian_state: &State<'a, ActiveGuardianState>,
    app_config_state: &State<'a, AppConfigState>,
    app_handle: &AppHandle,
) -> Result<(), Error> {
    let mut app_config = app_config_state.0.lock().await;
    let mut contract = app_config.connection().await?.contract;
    let guardians_state = contract
        .view::<_, contract::GuardiansState, Error>(
            "viewGuardiansState",
            &(),
            BlockIdentifier::LastFinal,
        )
        .await?;

    let guardian_public_keys: Vec<_> = guardians_state
        .iter()
        .map(|(_, guardian_state)| {
            guardian_state
                .public_key
                .as_ref()
                .ok_or(anyhow!("Missing public key registration in contract").into())
                .and_then(|bytes| {
                    decode::<GuardianPublicKey>(bytes)
                        .context("Could not decode guardian public key")
                        .map_err(Error::from)
                })
        })
        .collect::<Result<Vec<_>, Error>>()?;

    let active_guardian = active_guardian_state.0.lock().await;
    let Some(active_guardian) = active_guardian.as_ref() else {
        return Err(anyhow!("Expected active guardian state to be set").into());
    };
    let guardian_data_dir = guardian_data_dir(app_handle, active_guardian.guardian.account);
    let secret_key_path = guardian_data_dir.join(SECRET_KEY_FILE);
    let secret_key: GuardianSecretKey =
        read_encrypted_file(&active_guardian.password, &secret_key_path)?;
    let parameters = app_config.election_guard().await?.parameters;

    // First we validate the shares registered by peers.
    let mut guardian_key_shares = Vec::new();
    let mut invalid_share_submissions = Vec::new();
    for (guardian_account, guardian_state) in guardians_state {
        let share = guardian_state
            .encrypted_share
            .context("Guardian share not registered.")?;
        let Ok(mut shares) = decode::<Vec<GuardianEncryptedShare>>(&share) else {
            // If we cannot decode, the shares are invalid
            invalid_share_submissions.push(guardian_account);
            break;
        };
        let Ok(i) = shares.binary_search_by_key(
            &active_guardian.guardian.index,
            |x: &GuardianEncryptedShare| x.recipient,
        ) else {
            // If we cannot find our share, the list of shares submitted is invalid
            invalid_share_submissions.push(guardian_account);
            continue;
        };
        let share = shares.swap_remove(i);
        drop(shares);
        let dealer_public_key = &guardian_public_keys[share.dealer.get_zero_based_usize()];

        if share
            .decrypt_and_validate(&parameters, dealer_public_key, &secret_key)
            .is_err()
        {
            // Finally, if the share cannot be validated, the individual share is invalid
            invalid_share_submissions.push(guardian_account);
        } else {
            guardian_key_shares.push(share);
        }
    }

    if !invalid_share_submissions.is_empty() {
        return Err(Error::PeerValidation(invalid_share_submissions));
    }
    // Then we generate the secret share
    let secret_share = GuardianSecretKeyShare::compute(
        &parameters,
        &guardian_public_keys,
        &guardian_key_shares,
        &secret_key,
    )
    .context("Failed to combine guardian shares")?;
    let secret_share_path = guardian_data_dir.join(SECRET_SHARE_FILE);
    // Write to disk regardless of whether it already exists to avoid data
    // corruption (at least up until this point)
    write_encrypted_file(&active_guardian.password, &secret_share, &secret_share_path)?;

    Ok(())
}
/// Runs the flow for computing and storing the [`GuardianSecretShare`] on disk.
/// This has two potential outcomes:
/// 1. All peer encrypted shares are valid, the secret share is computed and
/// stored on disk and finally an OK signal is sent to the contract
/// 2. One or more invalid keys have been detected, a complaint with the
/// associated guardian accounts is registered in the election contract
///
/// The following steps are run:
/// 1. Validate peer keys + generate encrypted shares if successful
/// 2. Request approval of transaction proposal (either registration of shares
/// or complaint)
/// 3. Transaction submission + await finalization.
///
/// ## Errors
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
/// - [`Error::QueryFailed`]
#[tauri::command]
async fn generate_secret_share_flow<'a>(
    channel_id: String,
    active_guardian_state: State<'a, ActiveGuardianState>,
    app_config_state: State<'a, AppConfigState>,
    app_handle: AppHandle,
    window: Window,
) -> Result<(), Error> {
    let cancel = handle_abort(&channel_id, &window);
    let interaction = async {
        let encrypted_shares =
            match generate_secret_share(&active_guardian_state, &app_config_state, &app_handle)
                .await
            {
                Ok(..) => Ok(()),
                Err(Error::PeerValidation(accounts)) => Err(accounts),
                Err(error) => return Err(error),
            };

        let mut contract = app_config_state.0.lock().await.connection().await?.contract;
        let active_guardian_guard = active_guardian_state.0.lock().await;
        let active_guardian = active_guardian_guard
            .as_ref()
            .ok_or(anyhow!("Active account not set"))?;

        // Depending on whether any validation failures are detected, either:
        // 1. register the generated shares
        // 2. file a complaint with the guardian accounts with invalid key registrations
        let guardian_status = match encrypted_shares {
            Ok(..) => contract::GuardianStatus::VerificationSuccessful,
            Err(accounts) => contract::GuardianStatus::SharesVerificationFailed(accounts),
        };

        let contract_update = contract
            .dry_run_update::<contract::GuardianStatus, Error>(
                "registerGuardianStatus",
                Amount::zero(),
                active_guardian.guardian.account,
                &guardian_status,
            )
            .await?;
        let ccd_cost = energy_to_ccd(contract_update.current_energy(), &app_config_state).await?;
        let proposal = match guardian_status {
            contract::GuardianStatus::VerificationSuccessful => {
                ValidatedProposal::Success(ccd_cost)
            }
            contract::GuardianStatus::SharesVerificationFailed(_) => {
                ValidatedProposal::Complaint(ccd_cost)
            }
            _ => unreachable!(), // As we know the guardian_status is one of the above
        };

        // Wait for response from the user through the frontend
        wait_for_approval(&channel_id, &window, proposal).await?;

        contract_update
            .send(&active_guardian.guardian.keys)
            .await?
            .wait_for_finalization()
            .await?;

        Ok(())
    };

    tokio::select! {
        error = cancel => Err(error),
        res = interaction => res
    }
}

/// The data needed by the frontend, representing the current state of a
/// guardian as registered in the election contract
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct GuardianStateResponse {
    /// Whether the guardian has registered its encrypted shares
    has_encrypted_shares: bool,
    /// Whether the guardian has registered a public key
    has_public_key:       bool,
    /// The guardian index
    index:                u32,
    /// The guardian status registered for the guardian
    status:               Option<contract::GuardianStatus>,
}

impl From<&contract::GuardianState> for GuardianStateResponse {
    fn from(value: &contract::GuardianState) -> Self {
        Self {
            has_encrypted_shares: value.encrypted_share.is_some(),
            has_public_key:       value.public_key.is_some(),
            index:                value.index,
            status:               value.status.clone(),
        }
    }
}

/// Synchronizes the stored guardian state the election contract. Returns a
/// simplified version consisting of the data needed by the frontend
///
/// ## Errors
/// - [`Error::NetworkError`]
#[tauri::command]
async fn refresh_guardians<'a>(
    app_config_state: State<'a, AppConfigState>,
    guardians_state: State<'a, GuardiansState>,
) -> Result<Vec<(AccountAddress, GuardianStateResponse)>, Error> {
    let mut contract = app_config_state.0.lock().await.connection().await?.contract;
    let guardians_state_contract = contract
        .view::<OwnedParameter, contract::GuardiansState, Error>(
            "viewGuardiansState",
            &OwnedParameter::empty(),
            BlockIdentifier::LastFinal,
        )
        .await?;

    let response: Vec<_> = guardians_state_contract
        .iter()
        .map(|(account, guardian_state)| (*account, GuardianStateResponse::from(guardian_state)))
        .collect();

    let mut guardians_state = guardians_state.0.lock().await;
    *guardians_state = guardians_state_contract;

    Ok(response)
}

/// Initializes a connection to the contract and queries the necessary election
/// configuration data. Returns the election configuration stored in the
/// election contract
///
/// ## Errors
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
/// - [`Error::Http`]
#[tauri::command]
async fn connect(app_config_state: State<'_, AppConfigState>) -> Result<ElectionConfig, Error> {
    let mut app_config_guard = app_config_state.0.lock().await;
    let election_config = app_config_guard.election().await?;
    Ok(election_config)
}

/// Calculates the [`Amount`] for a given amount of [`Energy`].
///
/// ## Errors
/// - [`Error::NodeConnection`]
/// - [`Error::NetworkError`]
async fn energy_to_ccd<'a>(
    energy: Energy,
    app_config_state: &State<'a, AppConfigState>,
) -> Result<Amount, Error> {
    let mut app_config_guard = app_config_state.0.lock().await;
    let mut node = app_config_guard.connection().await?.contract.client;

    let chain_parameters = node
        .get_block_chain_parameters(BlockIdentifier::LastFinal)
        .await?
        .response;
    let amount = chain_parameters.ccd_cost(energy);
    Ok(amount)
}

fn main() {
    tauri::Builder::default()
        .setup(move |app: &mut App| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
                window.maximize().ok();
            }

            // Will not fail due to being declared accessible in `tauri.conf.json`
            let app_data_dir = app.path_resolver().app_data_dir().unwrap();
            if !app_data_dir.exists() {
                std::fs::create_dir(&app_data_dir)?;
            }

            Ok(())
        })
        .manage(ActiveGuardianState::default())
        .manage(AppConfigState::default())
        .manage(GuardiansState::default())
        .invoke_handler(tauri::generate_handler![
            connect,
            get_accounts,
            import_wallet_account,
            load_account,
            refresh_guardians,
            register_guardian_key_flow,
            register_guardian_shares_flow,
            generate_secret_share_flow,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
