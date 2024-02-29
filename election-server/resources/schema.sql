-- Table containing server settings
CREATE TABLE IF NOT EXISTS settings (
  id BOOL PRIMARY KEY DEFAULT true CHECK (id), -- To constrain table to have a single row.
  latest_height INT8,
  contract_index INT8 NOT NULL,
  contract_subindex INT8 NOT NULL
);

-- Table containing ballots successfully submitted to the contract monitored.
CREATE TABLE IF NOT EXISTS ballots (
  id INT8 PRIMARY KEY, -- For pagination
  transaction_hash BYTEA NOT NULL,
  block_time TIMESTAMP WITH TIME ZONE NOT NULL,
  ballot JSONB NOT NULL,
  account BYTEA NOT NULL,
  verified BOOL NOT NULL
);

-- Table containing voting power delegations
CREATE TABLE IF NOT EXISTS delegations (
  id INT8 PRIMARY KEY, -- For pagination
  transaction_hash BYTEA NOT NULL,
  block_time TIMESTAMP WITH TIME ZONE NOT NULL,
  from_account: BYTEA NOT NULL,
  to_account: BYTEA NOT NULL
);

-- Improve performance on queries for ballots within id range for an account.
CREATE INDEX IF NOT EXISTS ballots_account_id_idx ON ballots (account, id);

-- Improve performance on queries for delegations within id range for an account.
CREATE INDEX IF NOT EXISTS delegations_account_id_idx ON ballots (from_account, id);
CREATE INDEX IF NOT EXISTS delegations_account_id_idx ON ballots (to_account, id);
