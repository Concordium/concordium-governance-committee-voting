-- Table containing ballots successfully submitted to the contract monitored.
CREATE TABLE IF NOT EXISTS ballots (
  transaction_hash BYTEA PRIMARY KEY,
  height INT8 NOT NULL,
  timestamp INT8 NOT NULL,
  ballot JSONB NOT NULL,
  account BYTEA NOT NULL,
  verified BOOL DEFAULT false
);
