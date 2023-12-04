use anyhow::Context;
use axum::http::StatusCode;
use chrono::NaiveDateTime;
use concordium_governance_committee_election::RegisterVotesParameter;
use concordium_rust_sdk::{
    smart_contracts::common::{AccountAddress, ACCOUNT_ADDRESS_SIZE},
    types::{hashes::TransactionHash, AbsoluteBlockHeight, ContractAddress},
};
use deadpool_postgres::Object;
use serde::Serialize;
use tokio_postgres::{
    types::{Json, ToSql},
    NoTls,
};

#[derive(thiserror::Error, Debug)]
pub enum DatabaseError {
    #[error("{0}")]
    Postgres(#[from] tokio_postgres::Error),
    #[error("Failed to convert type")]
    TypeConversion,
    #[error("Could not configure database: {0}")]
    Configuration(#[from] anyhow::Error),
}

impl From<DatabaseError> for StatusCode {
    fn from(_: DatabaseError) -> Self {
        Self::INTERNAL_SERVER_ERROR
    }
}

type DatabaseResult<T = ()> = Result<T, DatabaseError>;

/// The server configuration stored in the DB.
#[derive(Debug, Serialize)]
pub struct StoredConfiguration {
    /// The latest recorded block height.
    pub latest_height: Option<AbsoluteBlockHeight>,
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
pub struct StoredBallotSubmission {
    /// The account which submitted the ballot
    pub account: AccountAddress,
    /// The ballot submitted
    pub ballot: RegisterVotesParameter,
    /// The transaction hash of the ballot submission
    #[serde(rename = "transactionHash")]
    pub transaction_hash: TransactionHash,
    /// The timestamp of the block the ballot submission was included in
    pub timestamp: NaiveDateTime,
    /// Whether the ballot proof could be verified.
    pub verified: bool,
}

impl TryFrom<tokio_postgres::Row> for StoredBallotSubmission {
    type Error = DatabaseError;

    fn try_from(value: tokio_postgres::Row) -> DatabaseResult<Self> {
        let raw_transaction_hash: &[u8] = value.try_get(0)?;
        let timestamp: NaiveDateTime = value.try_get(1)?;
        let Json(ballot) = value.try_get(2)?;
        let raw_account: &[u8] = value.try_get(3)?;
        let verified: bool = value.try_get(4)?;

        let account_bytes: [u8; ACCOUNT_ADDRESS_SIZE] = raw_account
            .try_into()
            .map_err(|_| DatabaseError::TypeConversion)?;

        let stored_ballot = StoredBallotSubmission {
            transaction_hash: raw_transaction_hash
                .try_into()
                .map_err(|_| DatabaseError::TypeConversion)?,
            timestamp,
            account: AccountAddress(account_bytes),
            ballot,
            verified,
        };

        Ok(stored_ballot)
    }
}

/// The set of queries used to communicate with the postgres DB.
pub struct PreparedStatements {
    /// Insert block into DB
    pub insert_ballot: tokio_postgres::Statement,
    /// Init the settings table
    pub init_settings: tokio_postgres::Statement,
    /// Get the settings stored in the settings table of the DB
    pub get_settings: tokio_postgres::Statement,
    /// Set the latest recorded block height from the DB
    pub set_latest_height: tokio_postgres::Statement,
    /// Get ballot submission by transaction hash
    pub get_ballot_submission: tokio_postgres::Statement,
    /// Get ballot submissions by account address
    pub get_ballot_submissions: tokio_postgres::Statement,
}

impl PreparedStatements {
    /// Construct `PreparedStatements` using the supplied
    /// `tokio_postgres::Client`
    async fn new(client: &Object) -> DatabaseResult<Self> {
        let insert_ballot = client
            .prepare(
                "INSERT INTO ballots (transaction_hash, timestamp, ballot, account, verified) \
                 VALUES ($1, $2, $3, $4, $5)",
            )
            .await?;
        let init_settings = client
            .prepare(
                "INSERT INTO settings (contract_index, contract_subindex) VALUES ($1, $2) ON \
                 CONFLICT DO NOTHING",
            )
            .await?;
        let get_settings = client
            .prepare("SELECT latest_height, contract_index, contract_subindex FROM settings")
            .await?;
        let set_latest_height = client
            .prepare("UPDATE settings SET latest_height = $1 WHERE id = true")
            .await?;
        let get_ballot_submission = client
            .prepare("SELECT transaction_hash, timestamp, ballot, account, verified from ballots WHERE transaction_hash = $1")
            .await?;
        let get_ballot_submissions = client
            .prepare("SELECT transaction_hash, timestamp, ballot, account, verified from ballots WHERE account = $1 ORDER BY timestamp ASC")
            .await?;
        Ok(Self {
            insert_ballot,
            init_settings,
            get_settings,
            set_latest_height,
            get_ballot_submission,
            get_ballot_submissions,
        })
    }

    /// Inserts a row in the settings table holding the application
    /// configuration. The table is constrained to only hold a single row.
    pub async fn init_settings(
        &self,
        db: &Object,
        contract_address: &ContractAddress,
    ) -> DatabaseResult<()> {
        let params: [&(dyn ToSql + Sync); 2] = [
            &(contract_address.index as i64),
            &(contract_address.subindex as i64),
        ];
        db.execute(&self.init_settings, &params).await?;
        Ok(())
    }

    /// Get the latest block height recorded in the DB.
    pub async fn get_settings(&self, db: &Object) -> DatabaseResult<StoredConfiguration> {
        db.query_one(&self.get_settings, &[]).await?.try_into()
    }

    /// Set the latest height in the DB.
    pub async fn set_latest_height<'a, 'b>(
        &'a self,
        db_tx: &tokio_postgres::Transaction<'b>,
        height: AbsoluteBlockHeight,
    ) -> DatabaseResult<()> {
        let params: [&(dyn ToSql + Sync); 1] = [&(height.height as i64)];
        db_tx.execute(&self.set_latest_height, &params).await?;
        Ok(())
    }

    /// Insert a ballot submission into the DB.
    pub async fn insert_ballot<'a, 'b>(
        &'a self,
        db_tx: &tokio_postgres::Transaction<'b>,
        ballot: &StoredBallotSubmission,
    ) -> DatabaseResult<()> {
        let params: [&(dyn ToSql + Sync); 5] = [
            &ballot.transaction_hash.as_ref(),
            &ballot.timestamp,
            &Json(&ballot.ballot),
            &ballot.account.0.as_ref(),
            &ballot.verified,
        ];
        db_tx.execute(&self.insert_ballot, &params).await?;
        Ok(())
    }

    /// Get ballot submission by transaction hash
    pub async fn get_ballot_submission(
        &self,
        db: &Object,
        transaction_hash: TransactionHash,
    ) -> DatabaseResult<Option<StoredBallotSubmission>> {
        let params: [&(dyn ToSql + Sync); 1] = [&transaction_hash.as_ref()];
        let row = db.query_opt(&self.get_ballot_submission, &params).await?;
        row.map(StoredBallotSubmission::try_from).transpose()
    }

    /// Get ballot submission by transaction hash
    pub async fn get_ballot_submissions(
        &self,
        db: &Object,
        account_address: AccountAddress,
    ) -> DatabaseResult<Vec<StoredBallotSubmission>> {
        let params: [&(dyn ToSql + Sync); 1] = [&account_address.0.as_ref()];
        let rows = db.query(&self.get_ballot_submissions, &params).await?;
        rows.into_iter()
            .map(StoredBallotSubmission::try_from)
            .collect()
    }
}

/// Holds [`tokio_postgres::Client`] to query the database and
/// [`PreparedStatements`] which can be executed with the client.
pub struct Database {
    pub client: Object,
    pub prepared: PreparedStatements,
}

impl AsRef<Object> for Database {
    fn as_ref(&self) -> &Object {
        &self.client
    }
}

impl Database {
    /// Create new `DBConn` from `tokio_postgres::config::Config`. If
    /// `try_create_tables` is true, database tables are created using
    /// `/resources/schema.sql`.
    pub async fn create(
        conn_string: tokio_postgres::config::Config,
        try_create_tables: bool,
    ) -> DatabaseResult<Self> {
        let single_pool = DatabasePool::create(conn_string, 1, try_create_tables)
            .await
            .context("Could not build database connection pool")?;
        let conn = single_pool
            .get()
            .await
            .context("Could not get database connection from pool")?;
        Ok(conn)
    }

    async fn from_managed_object(client: Object) -> DatabaseResult<Self> {
        let prepared = PreparedStatements::new(&client)
            .await
            .context("Failed to prepare statements with client")?;
        let db_conn = Self { client, prepared };

        Ok(db_conn)
    }
}

#[derive(Debug, Clone)]
pub struct DatabasePool {
    pool: deadpool_postgres::Pool,
}

impl DatabasePool {
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

        let client = pool
            .get()
            .await
            .context("Could not get database connection from pool")?;

        if try_create_tables {
            let create_statements = include_str!("../resources/schema.sql");
            client
                .batch_execute(create_statements)
                .await
                .context("Failed to execute create statements")?;
        }
        Ok(Self { pool })
    }

    pub async fn get(&self) -> DatabaseResult<Database> {
        let client = self
            .pool
            .get()
            .await
            .context("Failed to get connection from pool")?;
        let conn = Database::from_managed_object(client).await?;
        Ok(conn)
    }
}
