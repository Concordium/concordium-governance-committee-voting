use anyhow::Context;
use chrono::{DateTime, Utc};
use concordium_governance_committee_election::RegisterVotesParameter;
use concordium_rust_sdk::{
    smart_contracts::common::{AccountAddress, ACCOUNT_ADDRESS_SIZE},
    types::{hashes::TransactionHash, AbsoluteBlockHeight, ContractAddress},
};
use deadpool_postgres::{GenericClient, Object};
use serde::Serialize;
use tokio_postgres::{
    types::{Json, ToSql},
    NoTls,
};

use crate::types::BallotSubmission;

/// Represents possible errors returned from [`Database`] or [`DatabasePool`]
/// functions
#[derive(thiserror::Error, Debug)]
pub enum DatabaseError {
    /// An error happened while interacting with the postgres DB.
    #[error("{0}")]
    Postgres(#[from] tokio_postgres::Error),
    /// Failed to perform conversion from DB representation of type.
    #[error("Failed to convert type")]
    TypeConversion,
    /// Failed to configure database
    #[error("Could not configure database: {0}")]
    Configuration(#[from] anyhow::Error),
    /// Any other error happening
    #[error("{0}")]
    Other(String),
}

/// Alias for returning results with [`DatabaseError`]s as the `Err` variant.
type DatabaseResult<T> = Result<T, DatabaseError>;

/// The server configuration stored in the DB.
#[derive(Debug, Serialize)]
pub struct StoredConfiguration {
    /// The latest recorded block height.
    pub latest_height:    Option<AbsoluteBlockHeight>,
    /// The contract address of the election contract monitored.
    pub contract_address: ContractAddress,
}

impl TryFrom<tokio_postgres::Row> for StoredConfiguration {
    type Error = DatabaseError;

    fn try_from(value: tokio_postgres::Row) -> DatabaseResult<Self> {
        let raw_latest_height: Option<i64> = value.try_get(0)?;
        let raw_contract_index: i64 = value.try_get(1)?;
        let raw_contract_subindex: i64 = value.try_get(2)?;
        let contract_address =
            ContractAddress::new(raw_contract_index as u64, raw_contract_subindex as u64);
        let settings = Self {
            latest_height: raw_latest_height.map(|v| (v as u64).into()),
            contract_address,
        };
        Ok(settings)
    }
}

/// Describes an election ballot submission as it is stored in the database
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredBallotSubmission {
    /// The index of the ballot submission in the database
    pub id:               u64,
    /// The account which submitted the ballot
    pub account:          AccountAddress,
    /// The ballot submitted
    pub ballot:           RegisterVotesParameter,
    /// The transaction hash of the ballot submission
    pub transaction_hash: TransactionHash,
    /// The timestamp of the block the ballot submission was included in
    pub block_time:       DateTime<Utc>,
    /// Whether the ballot proof could be verified.
    pub verified:         bool,
}

impl TryFrom<tokio_postgres::Row> for StoredBallotSubmission {
    type Error = DatabaseError;

    fn try_from(value: tokio_postgres::Row) -> DatabaseResult<Self> {
        let id: i64 = value.try_get(0)?;
        let raw_transaction_hash: &[u8] = value.try_get(1)?;
        let block_time: DateTime<Utc> = value.try_get(2)?;
        let Json(ballot) = value.try_get(3)?;
        let raw_account: &[u8] = value.try_get(4)?;
        let verified: bool = value.try_get(5)?;

        let account_bytes: [u8; ACCOUNT_ADDRESS_SIZE] = raw_account
            .try_into()
            .map_err(|_| DatabaseError::TypeConversion)?;

        let stored_ballot = Self {
            id: id as u64,
            transaction_hash: raw_transaction_hash
                .try_into()
                .map_err(|_| DatabaseError::TypeConversion)?,
            block_time,
            account: AccountAddress(account_bytes),
            ballot,
            verified,
        };

        Ok(stored_ballot)
    }
}

/// Database client wrapper
pub struct Database {
    /// The database client
    pub client: Object,
}

impl From<Object> for Database {
    fn from(client: Object) -> Self { Self { client } }
}

impl AsRef<Object> for Database {
    fn as_ref(&self) -> &Object { &self.client }
}

impl Database {
    /// Inserts a row in the settings table holding the application
    /// configuration. The table is constrained to only hold a single row.
    pub async fn init_settings(&self, contract_address: &ContractAddress) -> DatabaseResult<()> {
        let init_settings = self
            .client
            .prepare_cached(
                "INSERT INTO settings (contract_index, contract_subindex) VALUES ($1, $2) ON \
                 CONFLICT DO NOTHING",
            )
            .await?;
        let params: [&(dyn ToSql + Sync); 2] = [
            &(contract_address.index as i64),
            &(contract_address.subindex as i64),
        ];
        self.client.execute(&init_settings, &params).await?;
        Ok(())
    }

    /// Get the latest block height recorded in the DB.
    pub async fn get_settings(&self) -> DatabaseResult<StoredConfiguration> {
        let get_settings = self
            .client
            .prepare_cached("SELECT latest_height, contract_index, contract_subindex FROM settings")
            .await?;
        self.client.query_one(&get_settings, &[]).await?.try_into()
    }

    /// Get ballot submission by transaction hash
    pub async fn get_ballot_submission(
        &self,
        transaction_hash: TransactionHash,
    ) -> DatabaseResult<Option<StoredBallotSubmission>> {
        let get_ballot_submission = self
            .client
            .prepare_cached(
                "SELECT transaction_hash, block_time, ballot, account, verified from ballots \
                 WHERE transaction_hash = $1",
            )
            .await?;
        let params: [&(dyn ToSql + Sync); 1] = [&transaction_hash.as_ref()];
        let row = self
            .client
            .query_opt(&get_ballot_submission, &params)
            .await?;
        row.map(StoredBallotSubmission::try_from).transpose()
    }

    /// Get ballot submission by account address within the give range.
    pub async fn get_ballot_submissions(
        &self,
        account_address: AccountAddress,
        from: Option<usize>,
        limit: usize,
    ) -> DatabaseResult<Vec<StoredBallotSubmission>> {
        let rows = if let Some(from) = from {
            let get_ballot_submissions = self
                .client
                .prepare_cached(
                    "SELECT id, transaction_hash, block_time, ballot, account, verified FROM \
                     ballots WHERE account = $1 AND id < $2 ORDER BY id DESC LIMIT $3",
                )
                .await?;
            let params: [&(dyn ToSql + Sync); 3] =
                [&account_address.0.as_ref(), &(from as i64), &(limit as i64)];
            self.client.query(&get_ballot_submissions, &params).await?
        } else {
            let get_ballot_submissions = self
                .client
                .prepare_cached(
                    "SELECT id, transaction_hash, block_time, ballot, account, verified FROM \
                     ballots WHERE account = $1 ORDER BY id DESC LIMIT $2",
                )
                .await?;
            let params: [&(dyn ToSql + Sync); 2] = [&account_address.0.as_ref(), &(limit as i64)];
            self.client.query(&get_ballot_submissions, &params).await?
        };

        rows.into_iter()
            .map(StoredBallotSubmission::try_from)
            .collect()
    }
}

/// Wrapper around a database transaction
pub struct Transaction<'a> {
    /// The inner transaction
    inner: &'a deadpool_postgres::Transaction<'a>,
}

impl<'a> From<&'a deadpool_postgres::Transaction<'a>> for Transaction<'a> {
    fn from(inner: &'a deadpool_postgres::Transaction<'a>) -> Self { Self { inner } }
}

impl<'a> Transaction<'a> {
    /// Set the latest height in the DB.
    pub async fn set_latest_height(&self, height: AbsoluteBlockHeight) -> DatabaseResult<()> {
        let set_latest_height = self
            .inner
            .prepare_cached("UPDATE settings SET latest_height = $1 WHERE id = true")
            .await?;
        let params: [&(dyn ToSql + Sync); 1] = [&(height.height as i64)];
        self.inner.execute(&set_latest_height, &params).await?;
        Ok(())
    }

    /// Insert a ballot submission into the DB.
    pub async fn insert_ballot(
        &self,
        ballot: &BallotSubmission,
        block_time: DateTime<Utc>,
    ) -> DatabaseResult<()> {
        let insert_ballot = self
            .inner
            .prepare_cached(
                "INSERT INTO ballots (transaction_hash, block_time, ballot, account, verified) \
                 VALUES ($1, $2, $3, $4, $5)",
            )
            .await?;

        let params: [&(dyn ToSql + Sync); 5] = [
            &ballot.transaction_hash.as_ref(),
            &block_time,
            &Json(&ballot.ballot),
            &ballot.account.0.as_ref(),
            &ballot.verified,
        ];
        self.inner.execute(&insert_ballot, &params).await?;
        Ok(())
    }
}

/// Representation of a database pool
#[derive(Debug, Clone)]
pub struct DatabasePool {
    /// The inner pool value.
    pool: deadpool_postgres::Pool,
}

impl DatabasePool {
    /// Create a new [`DatabasePool`] from [`tokio_postgres::Config`] of size
    /// `pool_size`. If `try_create_tables` is true, database tables are
    /// created using `/resources/schema.sql`.
    pub async fn create(
        db_config: tokio_postgres::Config,
        pool_size: usize,
        try_create_tables: bool,
    ) -> DatabaseResult<Self> {
        let manager_config = deadpool_postgres::ManagerConfig {
            recycling_method: deadpool_postgres::RecyclingMethod::Verified,
        };

        let manager = deadpool_postgres::Manager::from_config(db_config, NoTls, manager_config);
        let pool = deadpool_postgres::Pool::builder(manager)
            .create_timeout(Some(std::time::Duration::from_secs(5)))
            .recycle_timeout(Some(std::time::Duration::from_secs(5)))
            .wait_timeout(Some(std::time::Duration::from_secs(5)))
            .max_size(pool_size)
            .runtime(deadpool_postgres::Runtime::Tokio1)
            .build()
            .context("Failed to build database pool")?;

        if try_create_tables {
            let client = pool
                .get()
                .await
                .context("Could not get database connection from pool")?;
            client
                .batch_execute(include_str!("../resources/schema.sql"))
                .await
                .context("Failed to execute create statements")?;
        }
        Ok(Self { pool })
    }

    /// Get a [`Database`] connection from the pool.
    pub async fn get(&self) -> DatabaseResult<Database> {
        let client = self
            .pool
            .get()
            .await
            .context("Failed to get connection from pool")?;
        Ok(client.into())
    }
}
