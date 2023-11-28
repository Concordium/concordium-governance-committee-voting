-- Table containing server settings
CREATE TABLE IF NOT EXISTS settings (
  id BOOL PRIMARY KEY DEFAULT true CHECK (id), -- To constrain table to have a single row.
  latest_height INT8 DEFAULT 0,
  contract_index INT8 NOT NULL,
  contract_subindex INT8 NOT NULL
);

-- Table containing ballots successfully submitted to the contract monitored.
CREATE TABLE IF NOT EXISTS ballots (
  transaction_hash BYTEA PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  ballot JSONB NOT NULL,
  account BYTEA NOT NULL,
  verified BOOL DEFAULT false
);
