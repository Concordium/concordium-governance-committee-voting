// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use concordium_governance_committee_election::{
    self as contract, ChecksumUrl, ElectionConfig, HashSha2256,
};
use concordium_rust_sdk::{
    common::encryption::{decrypt, encrypt, EncryptedData, Password},
    contract_client::{ContractClient, ViewError},
    id::types::AccountKeys,
    smart_contracts::common::AccountAddress,
    types::{smart_contracts::OwnedParameter, ContractAddress, Energy, WalletAccount},
    v2::{BlockIdentifier, Client, Endpoint, QueryError},
};
use contract::GuardianStatus;
use eg::{
    election_manifest::ElectionManifest, election_parameters::ElectionParameters,
    guardian::GuardianIndex, guardian_public_key::GuardianPublicKey,
    guardian_secret_key::GuardianSecretKey,
};
use rand::{thread_rng, Rng};
use serde::{de::DeserializeOwned, Serialize};
use sha2::Digest;
use std::{
    path::{Path, PathBuf},
    str::FromStr,
    time::Duration,
};
use tauri::{App, AppHandle, State, Window};
use tokio::sync::Mutex;
use util::csprng::Csprng;

/// The file name of the encrypted wallet account.
const WALLET_ACCOUNT_FILE: &str = "guardian-data.json.aes";
/// The fiel name of the encrypted secret key for a guardian
const SECRET_KEY_FILE: &str = "secret-key.json.aes";

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
    /// The selected account
    account:        AccountAddress,
    /// The password used for encryption with the selected account
    password:       Password,
    /// The guardian index of the guardian.
    guardian_index: GuardianIndex,
}

/// The type of managed state for the active guardian
#[derive(Default)]
struct ActiveGuardianState(Mutex<Option<ActiveGuardian>>);

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
type ElectionClient = ContractClient<ElectionContractMarker>;

#[derive(Clone)]
struct ConnectionConfig {
    contract: ElectionClient,
    #[allow(dead_code)] // TODO: remove when it is used
    node: Client,
}

#[derive(Debug, thiserror::Error)]
enum CheckedResourceError {
    #[error("{0}")]
    Http(#[from] reqwest::Error),
    #[error("Verification of data failed")]
    Verification,
    #[error("Deserialization failed: {0}")]
    Deserialize(#[from] serde_json::Error),
}

async fn get_resource_checked<J: DeserializeOwned>(
    url: &ChecksumUrl,
) -> Result<J, CheckedResourceError> {
    let data = reqwest::get(url.url.clone()).await?.bytes().await?;

    let hash = HashSha2256(sha2::Sha256::digest(&data).into());
    if url.hash != hash {
        return Err(CheckedResourceError::Verification);
    }

    serde_json::from_slice(&data).map_err(CheckedResourceError::from)
}

#[derive(Debug, thiserror::Error)]
enum AppConfigError {
    #[error("{0}")]
    Connect(#[from] tonic::transport::Error),
    #[error("{0}")]
    Contract(#[from] QueryError),
    #[error("Failed to query election contract configuration: {0}")]
    ContractQuery(#[from] ViewError),
    #[error("{0}")]
    CheckedResource(#[from] CheckedResourceError),
}

impl serde::Serialize for AppConfigError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

impl ConnectionConfig {
    /// Creates a connection to a concordium node and a contract client. This
    /// function panics if the necessary environment variables are not set.
    async fn try_create_from_env() -> Result<Self, AppConfigError> {
        let endpoint_var = option_env!("CCD_ELECTION_NODE")
            .expect(r#"Expected environment variable "CCD_ELECTION_NODE" to be defined"#); // We
        let endpoint = Endpoint::from_str(endpoint_var).expect("Could not parse node endpoint");
        let node = Client::new(endpoint).await?;

        let contract_var = option_env!("CCD_ELECTION_CONTRACT_ADDRESS")
            .expect(r#"Expected environment variabled "CCD_ELECTION_CONTRACT" to be defined"#);
        let contract_address =
            ContractAddress::from_str(contract_var).expect("Could not parse contract address");
        let contract = ElectionClient::create(node.clone(), contract_address).await?;

        let contract_connection = Self { contract, node };
        Ok(contract_connection)
    }

    async fn try_get_election_config(
        &mut self,
    ) -> Result<(ElectionConfig, ElectionGuardConfig), AppConfigError> {
        let config: ElectionConfig = self
            .contract
            .view::<OwnedParameter, ElectionConfig, ViewError>(
                "viewConfig",
                &OwnedParameter::empty(),
                BlockIdentifier::LastFinal,
            )
            .await?;
        let manifest: ElectionManifest = get_resource_checked(&config.election_manifest).await?;
        let parameters: ElectionParameters =
            get_resource_checked(&config.election_parameters).await?;

        let eg_config = ElectionGuardConfig {
            manifest,
            parameters,
        };
        Ok((config, eg_config))
    }
}

#[derive(Default, Clone)]
struct AppConfig {
    connection:     Option<ConnectionConfig>,
    election:       Option<ElectionConfig>,
    election_guard: Option<ElectionGuardConfig>,
}

impl AppConfig {
    async fn connection(&mut self) -> Result<ConnectionConfig, AppConfigError> {
        let connection = if let Some(connection) = &self.connection {
            connection.clone()
        } else {
            let connection = ConnectionConfig::try_create_from_env().await?;
            self.connection = Some(connection.clone());
            connection
        };

        Ok(connection)
    }

    async fn election_guard(&mut self) -> Result<ElectionGuardConfig, AppConfigError> {
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

    async fn election(&mut self) -> Result<ElectionConfig, AppConfigError> {
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

#[derive(Default)]
struct AppConfigState(Mutex<AppConfig>);

impl serde::Serialize for ImportWalletError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Stores the account in global state.
async fn use_guardian<'a>(
    guardian: &GuardianData,
    password: Password,
    state: State<'a, ActiveGuardianState>,
) {
    let mut active_account = state.0.lock().await;
    *active_account = Some(ActiveGuardian {
        account: guardian.account,
        password,
        guardian_index: guardian.index,
    });
}

/// Get the data directory for a guardian account
fn guardian_data_dir(app_handle: &AppHandle, account: AccountAddress) -> PathBuf {
    app_handle
        .path_resolver()
        .app_data_dir()
        .unwrap() // Path is available as declared in `tauri.conf.json`
        .join(account.to_string())
}

/// Possible errors when encrypting data and writing it to disk.
#[derive(thiserror::Error, Debug)]
enum WriteEncryptedError {
    /// Serialization of data type failed
    #[error("Serialization of data type failed")]
    Serialize(#[from] serde_json::Error),
    /// [`std::io::Error`] while attempting to write to disk
    #[error("{0}")]
    IO(#[from] std::io::Error),
}

/// Writes `data` encrypted with `password` to disk
fn write_encrypted_file<D: serde::Serialize>(
    password: &Password,
    data: &D,
    file_path: &Path,
) -> Result<(), WriteEncryptedError> {
    let plaintext = serde_json::to_string(&data)?;
    let mut rng = thread_rng();
    // Serialization will not fail at this point.
    let encrypted_data = serde_json::to_vec(&encrypt(&password, &plaintext, &mut rng)).unwrap();
    std::fs::write(file_path, encrypted_data)?;

    Ok(())
}

/// Errors which happen when reading an encrypted file.
#[derive(thiserror::Error, Debug)]
enum ReadEncryptedError {
    /// Decryption of file contents failed
    #[error("Decryption of data failed")]
    Decrypt,
    /// [`std::io::Error`] while attempting to write to disk
    #[error("{0}")]
    IO(#[from] std::io::Error),
    /// Could not deserialize into encrypted data
    #[error("File corruption detected for {0}")]
    Corrupted(PathBuf),
}

impl From<serde_json::Error> for ReadEncryptedError {
    fn from(_: serde_json::Error) -> Self { ReadEncryptedError::Decrypt }
}

/// Deserialize contents of an encrypted file.
fn read_encrypted_file<D: serde::de::DeserializeOwned>(
    password: &Password,
    file_path: &PathBuf,
) -> Result<D, ReadEncryptedError> {
    let encrypted_bytes = std::fs::read(file_path)?;
    let encrypted: EncryptedData = serde_json::from_slice(&encrypted_bytes)
        .map_err(|_| ReadEncryptedError::Corrupted(file_path.clone()))?;

    let decrypted_bytes =
        decrypt(&password, &encrypted).map_err(|_| ReadEncryptedError::Decrypt)?;
    let value =
        serde_json::from_slice(&decrypted_bytes).map_err(|_| ReadEncryptedError::Decrypt)?;
    Ok(value)
}

/// Describes possible errors when importing an account.
#[derive(thiserror::Error, Debug)]
enum ImportWalletError {
    /// An error happened while trying to write to disk
    #[error("Could not save account: {0}")]
    Write(#[from] WriteEncryptedError),
    /// Account has already been imported
    #[error("Account already found in application")]
    Duplicate,
}

/// Handle a wallet import. Creates a directory for storing data associated with
/// the guardian account.
///
/// This will create the data directory for the app if it does not already
/// exist.
///
/// ## Errors
/// Fails if the account has already been imported or if the guardian data could
/// not be written to disk (which should not happen).
#[tauri::command]
async fn import_wallet_account<'a>(
    wallet_account: WalletAccount,
    guardian_index: GuardianIndex,
    password: String,
    active_guardian_state: State<'a, ActiveGuardianState>,
    app_handle: AppHandle,
) -> Result<GuardianData, ImportWalletError> {
    let account = wallet_account.address;

    let guardian_dir = guardian_data_dir(&app_handle, account);
    if guardian_dir.exists() {
        return Err(ImportWalletError::Duplicate);
    }
    std::fs::create_dir(&guardian_dir).map_err(WriteEncryptedError::from)?;

    let password = Password::from(password);
    let guardian_data = GuardianData::create(wallet_account, guardian_index);
    write_encrypted_file(
        &password,
        &guardian_data,
        &guardian_dir.join(WALLET_ACCOUNT_FILE),
    )?;
    use_guardian(&guardian_data, password, active_guardian_state).await;

    Ok(guardian_data)
}

/// Represents an IO error happening while loading accounts from disk. This
/// should never happen in practice due to accounts being loaded right after
/// ensuring the data directory for the application exists during setup.
#[derive(thiserror::Error, Debug)]
#[error("Could not read app data")]
struct GetAccountsError(#[from] std::io::Error);

impl serde::Serialize for GetAccountsError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Gets the accounts which have previously been imported into the application.
///
/// ## Errors
/// Fails if the appliction data directory could not be read, which should not
/// happen due to ensuring the existence during application setup.
#[tauri::command(async)]
fn get_accounts(handle: AppHandle) -> Result<Vec<AccountAddress>, GetAccountsError> {
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

/// Describes possible errors when loading an account from disk.
#[derive(thiserror::Error, Debug)]
#[error("Failed to load guardian account: {0}")]
struct LoadWalletError(#[from] ReadEncryptedError);

impl serde::Serialize for LoadWalletError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

/// Load a [`GuardianAccount`] from disk, decrypting the contents with
/// `password`
#[tauri::command]
async fn load_account<'a>(
    account: AccountAddress,
    password: String,
    app_handle: AppHandle,
    active_guardian_state: State<'a, ActiveGuardianState>,
) -> Result<GuardianData, LoadWalletError> {
    let password = Password::from(password);
    let account_path = guardian_data_dir(&app_handle, account).join(WALLET_ACCOUNT_FILE);
    let guardian_data: GuardianData = read_encrypted_file(&password, &account_path)?;
    use_guardian(&guardian_data, password, active_guardian_state).await;

    Ok(guardian_data)
}

/// Describes the possible errors that can happen when generating a guardian key
/// pair
#[derive(thiserror::Error, Debug)]
enum GenerateKeyPairError {
    /// Missing application state. Should not happen due to user behavioiur.
    #[error("Application state missing: {0}")]
    MissingState(String),
    /// The guardian has already generated a key. Should only happen due to
    /// corruption of file.
    #[error("Existing key found, but could not be read: {0}")]
    ReadExisting(#[from] ReadEncryptedError),
    /// The key could not be written to disk. Should not happen due to user
    /// behaviour.
    #[error("Could not write the key to disk: {0}")]
    Write(#[from] WriteEncryptedError),
}

impl From<AppConfigError> for GenerateKeyPairError {
    fn from(value: AppConfigError) -> Self { GenerateKeyPairError::MissingState(value.to_string()) }
}

/// Generate a key pair for the selected guardian, storing the secret key on
/// disk and returning the public key. If the secret key already exists, it
/// returns the corresponding public key.
///
/// ## Errors
/// Any errors happening will be due to data corruption or internal errors.
async fn generate_key_pair<'a>(
    active_guardian_state: State<'a, ActiveGuardianState>,
    app_config: State<'a, AppConfigState>,
    app_handle: AppHandle,
) -> Result<GuardianPublicKey, GenerateKeyPairError> {
    let active_guardian_guard = active_guardian_state.0.lock().await;
    let active_guardian =
        active_guardian_guard
            .as_ref()
            .ok_or(GenerateKeyPairError::MissingState(
                "Active account not set".to_string(),
            ))?;
    let account = active_guardian.account;
    let secret_key_path = guardian_data_dir(&app_handle, account).join(SECRET_KEY_FILE);

    let secret_key = if secret_key_path.exists() {
        let secret_key = read_encrypted_file(&active_guardian.password, &secret_key_path)?;
        secret_key
    } else {
        let mut app_config_guard = app_config.0.lock().await;
        let app_config = app_config_guard.election_guard().await?;
        let seed: [u8; 32] = thread_rng().gen();
        let mut csprng = Csprng::new(&seed);
        let secret_key = GuardianSecretKey::generate(
            &mut csprng,
            &app_config.parameters,
            active_guardian.guardian_index,
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
    let response = receiver.await.unwrap(); // Sender will not be dropped.
    response
}

#[derive(Debug, thiserror::Error)]
enum SendPublicKeyRegistrationError {
    #[error("{0}")]
    Generate(#[from] GenerateKeyPairError),
    #[error("Internal error happened: {0}")]
    Internal(String),
}

impl serde::Serialize for SendPublicKeyRegistrationError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer, {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[tauri::command]
async fn send_public_key_registration<'a>(
    active_guardian_state: State<'a, ActiveGuardianState>,
    app_config_state: State<'a, AppConfigState>,
    channel_id: String,
    app_handle: AppHandle,
    window: Window,
) -> Result<(), SendPublicKeyRegistrationError> {
    eprintln!("START");
    let public_key = generate_key_pair(active_guardian_state, app_config_state, app_handle).await?;
    eprintln!("PUB KEY {:?}", public_key);
    let response: bool = match send_message(&window, &channel_id, Energy { energy: 400 }).await {
        Ok(Some(value)) => value,
        Ok(None) => {
            return Err(SendPublicKeyRegistrationError::Internal(
                "Expected response with value from frontend".into(),
            ))
        }
        Err(error) => return Err(SendPublicKeyRegistrationError::Internal(error.to_string())),
    };
    eprintln!("RESPONSE {}", response);

    // Continue the work
    tokio::time::sleep(Duration::from_secs(3)).await;
    eprintln!("END");
    Ok(())
}

#[derive(serde::Serialize)]
struct GuardianStateResponse {
    has_encrypted_share: bool,
    has_public_key:      bool,
    index:               u32,
    status:              Option<GuardianStatus>,
}

impl From<&contract::GuardianState> for GuardianStateResponse {
    fn from(value: &contract::GuardianState) -> Self {
        Self {
            has_encrypted_share: value.encrypted_share.is_some(),
            has_public_key:      value.public_key.is_some(),
            index:               value.index,
            status:              value.status.clone(),
        }
    }
}

#[tauri::command]
async fn refresh_guardians<'a>(
    app_config_state: State<'a, AppConfigState>,
    guardians_state: State<'a, GuardiansState>,
) -> Result<Vec<(AccountAddress, GuardianStateResponse)>, AppConfigError> {
    let mut contract = app_config_state.0.lock().await.connection().await?.contract;
    let guardians_state_contract = contract
        .view::<OwnedParameter, contract::GuardiansState, ViewError>(
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

#[tauri::command]
async fn connect<'a>(
    app_config_state: State<'a, AppConfigState>,
) -> Result<ElectionConfig, AppConfigError> {
    let mut app_config = app_config_state.0.lock().await;
    let election_config = app_config.election().await?;
    Ok(election_config)
}

fn main() {
    tauri::Builder::default()
        .setup(move |app: &mut App| {
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
            send_public_key_registration,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
