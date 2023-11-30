use anyhow::Context;
use chrono::NaiveDateTime;
use concordium_governance_committee_election::RegisterVotesParameter;
use concordium_rust_sdk::{types::{ContractAddress, AbsoluteBlockHeight, hashes::TransactionHash}, smart_contracts::common::AccountAddress};
use tokio::task::JoinHandle;
use tokio_postgres::types::{ToSql, Json};

/// The server configuration stored in the DB.
pub struct StoredConfiguration {
    /// The latest recorded block height.
    pub latest_height:    Option<AbsoluteBlockHeight>,
    /// The contract address of the election contract monitored.
    pub contract_address: ContractAddress,
}

impl TryFrom<tokio_postgres::Row> for StoredConfiguration {
    type Error = tokio_postgres::Error;

    fn try_from(value: tokio_postgres::Row) -> Result<Self, Self::Error> {
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

/// Describes an election ballot submission
pub struct StoredBallotSubmission {
    /// The account which submitted the ballot
    pub account:          AccountAddress,
    /// The ballot submitted
    pub ballot:           RegisterVotesParameter,
    /// The transaction hash of the ballot submission
    pub transaction_hash: TransactionHash,
    /// The timestamp of the block the ballot submission was included in
    pub timestamp: NaiveDateTime,
    /// Whether the ballot proof could be verified.
    pub verified:         bool,
}

/// The set of queries used to communicate with the postgres DB.
pub struct PreparedStatements {
    /// Insert block into DB
    pub insert_ballot:     tokio_postgres::Statement,
    /// Init the settings table
    pub init_settings:     tokio_postgres::Statement,
    /// Get the settings stored in the settings table of the DB
    pub get_settings:      tokio_postgres::Statement,
    /// Get the latest recorded block height from the DB
    pub set_latest_height: tokio_postgres::Statement,
}

impl PreparedStatements {
    /// Construct `PreparedStatements` using the supplied
    /// `tokio_postgres::Client`
    async fn new(client: &tokio_postgres::Client) -> Result<Self, tokio_postgres::Error> {
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
        Ok(Self {
            insert_ballot,
            init_settings,
            get_settings,
            set_latest_height,
        })
    }

    /// Inserts a row in the settings table holding the application
    /// configuration. The table is constrained to only hold a single row.
    pub async fn init_settings(
        &self,
        db: &tokio_postgres::Client,
        contract_address: &ContractAddress,
    ) -> Result<(), tokio_postgres::Error> {
        let params: [&(dyn ToSql + Sync); 2] = [
            &(contract_address.index as i64),
            &(contract_address.subindex as i64),
        ];
        db.execute(&self.init_settings, &params).await?;
        Ok(())
    }

    /// Get the latest block height recorded in the DB.
    pub async fn get_settings(
        &self,
        db: &tokio_postgres::Client,
    ) -> Result<StoredConfiguration, tokio_postgres::Error> {
        db.query_one(&self.get_settings, &[]).await?.try_into()
    }

    /// Set the latest height in the DB.
    pub async fn set_latest_height<'a, 'b>(
        &'a self,
        db_tx: &tokio_postgres::Transaction<'b>,
        height: AbsoluteBlockHeight,
    ) -> Result<(), tokio_postgres::Error> {
        let params: [&(dyn ToSql + Sync); 1] = [&(height.height as i64)];
        db_tx.execute(&self.set_latest_height, &params).await?;
        Ok(())
    }

    /// Insert a ballot submission into the DB.
    pub async fn insert_ballot<'a, 'b>(
        &'a self,
        db_tx: &tokio_postgres::Transaction<'b>,
        ballot: &StoredBallotSubmission,
    ) -> anyhow::Result<()> {
        // let timestamp = NaiveDateTime::from_timestamp_millis(timestamp.timestamp_millis())
        //     .context("Expect timestamp to be in range of u64")?;
        let params: [&(dyn ToSql + Sync); 5] = [
            &ballot.transaction_hash.as_ref(),
            &ballot.timestamp,
            &Json(&ballot.ballot),
            &ballot.account.0.as_ref(),
            &false,
        ];
        db_tx.execute(&self.insert_ballot, &params).await?;
        Ok(())
    }
}

/// Holds [`tokio_postgres::Client`] to query the database and
/// [`PreparedStatements`] which can be executed with the client.
pub struct DBConn {
    pub client:            tokio_postgres::Client,
    pub prepared:          PreparedStatements,
    pub connection_handle: JoinHandle<()>,
}

impl DBConn {
    /// Create new `DBConn` from `tokio_postgres::config::Config`. If
    /// `try_create_tables` is true, database tables are created using
    /// `/resources/schema.sql`.
    #[tracing::instrument]
    pub async fn create(
        conn_string: tokio_postgres::config::Config,
        try_create_tables: bool,
    ) -> anyhow::Result<Self> {
        let (client, connection) = conn_string
            .connect(tokio_postgres::NoTls)
            .await
            .context("Could not create database connection")?;

        let connection_handle = tokio::spawn(async move {
            if let Err(e) = connection.await {
                tracing::error!("Connection error: {}", e);
            }
        });

        if try_create_tables {
            let create_statements = include_str!("../resources/schema.sql");
            client
                .batch_execute(create_statements)
                .await
                .context("Failed to execute create statements")?;
        }

        let prepared = PreparedStatements::new(&client).await?;
        let db_conn = DBConn {
            client,
            prepared,
            connection_handle,
        };

        Ok(db_conn)
    }
}
