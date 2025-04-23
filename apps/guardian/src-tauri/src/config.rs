use std::{str::FromStr, sync::LazyLock};

use anyhow::{anyhow, Context};
use concordium_governance_committee_election::{self as contract};
use concordium_rust_sdk::{
    common::types::Amount,
    contract_client::{ContractClient, ContractUpdateBuilder},
    id::types::AccountAddress,
    v2::{self, BlockIdentifier},
};
use eg::{
    election_manifest::ElectionManifest, election_parameters::ElectionParameters,
    guardian_public_key::GuardianPublicKey, guardian_share::GuardianEncryptedShare,
};
use election_common::{
    decode, encode, EncryptedTally, GuardianDecryption, GuardianDecryptionProof, HttpClient,
};
use tonic::transport::ClientTlsConfig;

use crate::{
    shared::{Error, GenesisHash, DEFAULT_REQUEST_TIMEOUT_MS},
    user_config::UserConfig,
};

static TIMEOUT: LazyLock<u64> = LazyLock::new(|| {
    option_env!("CCD_ELECTION_REQUEST_TIMEOUT_MS")
        .map(|v| u64::from_str(v).expect("Could not parse CCD_ELECTION_REQUEST_TIMEOUT_MS"))
        .unwrap_or(DEFAULT_REQUEST_TIMEOUT_MS.into())
});

static HTTP_CLIENT: LazyLock<HttpClient> =
    LazyLock::new(|| HttpClient::try_create(*TIMEOUT).expect("Failed to create HTTP client"));

/// The necessary election guard configuration to construct election guard
/// entities.
#[derive(Clone)]
pub struct ElectionGuardConfig {
    /// The election manifest
    pub manifest:   ElectionManifest,
    /// The election parameters
    pub parameters: ElectionParameters,
}

pub struct ElectionContractMarker;
pub type ElectionClient = ContractClient<ElectionContractMarker>;
/// The election contract client
#[derive(Clone)]
pub struct ElectionContract(pub ElectionClient);

impl ElectionContract {
    pub async fn election_config(&mut self) -> Result<contract::ElectionConfig, Error> {
        let config = self
            .0
            .view::<_, contract::ElectionConfig, Error>(
                "viewConfig",
                &(),
                BlockIdentifier::LastFinal,
            )
            .await?;

        Ok(config)
    }

    pub async fn encrypted_tally(&mut self) -> Result<Option<EncryptedTally>, Error> {
        let tally = self
            .0
            .view::<_, Option<Vec<u8>>, Error>(
                "viewEncryptedTally",
                &(),
                BlockIdentifier::LastFinal,
            )
            .await?;
        let Some(tally) = tally else {
            return Ok(None);
        };

        let tally: EncryptedTally =
            decode(&tally).context("Failed to deserialize the encrypted tally")?;

        Ok(Some(tally))
    }

    pub async fn guardians_state(&mut self) -> Result<contract::GuardiansState, Error> {
        let state = self
            .0
            .view::<_, contract::GuardiansState, Error>(
                "viewGuardiansState",
                &(),
                BlockIdentifier::LastFinal,
            )
            .await?;

        Ok(state)
    }

    pub async fn register_guardian_public_key(
        &mut self,
        sender: &AccountAddress,
        public_key: &GuardianPublicKey,
    ) -> Result<ContractUpdateBuilder, Error> {
        let update = self
            .0
            .dry_run_update::<Vec<u8>, Error>(
                "registerGuardianPublicKey",
                Amount::zero(),
                *sender,
                &encode(public_key).unwrap(), // Serialization will not fail
            )
            .await?;

        Ok(update)
    }

    pub async fn register_encrypted_shares(
        &mut self,
        sender: &AccountAddress,
        shares: &Vec<GuardianEncryptedShare>,
    ) -> Result<ContractUpdateBuilder, Error> {
        let update = self
            .0
            .dry_run_update::<Vec<u8>, Error>(
                "registerGuardianEncryptedShare",
                Amount::zero(),
                *sender,
                &encode(shares).unwrap(), // Serialization will not fail
            )
            .await?;

        Ok(update)
    }

    pub async fn register_guardian_status(
        &mut self,
        sender: &AccountAddress,
        guardian_status: &contract::GuardianStatus,
    ) -> Result<ContractUpdateBuilder, Error> {
        let update = self
            .0
            .dry_run_update::<contract::GuardianStatus, Error>(
                "registerGuardianStatus",
                Amount::zero(),
                *sender,
                guardian_status,
            )
            .await?;

        Ok(update)
    }

    pub async fn post_decryption(
        &mut self,
        sender: &AccountAddress,
        decryption: &GuardianDecryption,
    ) -> Result<ContractUpdateBuilder, Error> {
        let update = self
            .0
            .dry_run_update::<Vec<u8>, Error>(
                "postDecryptionShare",
                Amount::zero(),
                *sender,
                &encode(decryption).unwrap(), // Serialization will not fail
            )
            .await?;

        Ok(update)
    }

    pub async fn post_decryption_proof(
        &mut self,
        sender: &AccountAddress,
        shares: &GuardianDecryptionProof,
    ) -> Result<ContractUpdateBuilder, Error> {
        let update = self
            .0
            .dry_run_update::<Vec<u8>, Error>(
                "postDecryptionProofResponseShare",
                Amount::zero(),
                *sender,
                &encode(shares).unwrap(), // Serialization will not fail
            )
            .await?;

        Ok(update)
    }
}

pub struct AppConfig {
    /// The user config loaded from disc
    config:         UserConfig,
    /// The contract client for querying the contract.
    contract:       Option<ElectionContract>,
    /// The election config registered in the contract.
    election:       Option<contract::ElectionConfig>,
    /// The election guard config.
    election_guard: Option<ElectionGuardConfig>,
}

impl From<UserConfig> for AppConfig {
    fn from(config: UserConfig) -> Self {
        Self {
            config,
            contract: None,
            election: None,
            election_guard: None,
        }
    }
}

impl AppConfig {
    pub async fn refresh(&mut self, config: UserConfig) -> Result<(), Error> {
        self.config = config;
        self.contract = None;
        self.election = None;
        self.election_guard = None;
        Ok(())
    }

    pub async fn contract(&mut self) -> Result<ElectionContract, Error> {
        if let Some(contract) = &self.contract {
            return Ok(contract.clone());
        }

        let Some(contract_address) = self.config.contract else {
            return Err(Error::IncompleteConfiguration("contract".to_string()));
        };

        let node_endpoint = self.config.node();
        let network = self.config.network;

        let endpoint = if node_endpoint
            .uri()
            .scheme()
            .map_or(false, |x| x == &v2::Scheme::HTTPS)
        {
            node_endpoint
                .tls_config(ClientTlsConfig::new())
                .context("Unable to construct TLS configuration for Concordium API.")?
        } else {
            node_endpoint
        };

        let timeout = core::time::Duration::from_millis(*TIMEOUT);
        let endpoint = endpoint.connect_timeout(timeout).timeout(timeout);
        let mut node = v2::Client::new(endpoint).await?;

        let genesis_hash = node.get_consensus_info().await?.genesis_block;
        let expected_genesis_hash = network.genesis_hash();
        if genesis_hash != expected_genesis_hash {
            return Err(anyhow!(
                "Invalid node specified. Application must use a {} node",
                network
            )
            .into());
        }

        let contract = ElectionContract(ElectionClient::create(node, contract_address).await?);
        self.contract = Some(contract.clone());
        Ok(contract)
    }

    pub async fn election(&mut self) -> Result<contract::ElectionConfig, Error> {
        if let Some(election) = &self.election {
            return Ok(election.clone());
        }

        let config: contract::ElectionConfig = self.contract().await?.election_config().await?;
        self.election = Some(config.clone());
        Ok(config)
    }

    pub async fn election_guard(&mut self) -> Result<ElectionGuardConfig, Error> {
        if let Some(eg_config) = &self.election_guard {
            return Ok(eg_config.clone());
        }

        let election = self.election().await?;
        let manifest: ElectionManifest = HTTP_CLIENT
            .get_json_resource_checked(&election.election_manifest)
            .await?;
        let parameters: ElectionParameters = HTTP_CLIENT
            .get_json_resource_checked(&election.election_parameters)
            .await?;

        let eg_config = ElectionGuardConfig {
            manifest,
            parameters,
        };
        self.election_guard = Some(eg_config.clone());
        Ok(eg_config)
    }
}
