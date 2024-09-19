## Unreleased

- Bumped rust-sdk dependency to 5.0

## 1.0.0

- Update the referenced election contract version

## 0.2.5

- Adds an HTML response cache for voting dapp renders for each election phase.
- Expands the configuration passed to the frontend with contract state corresponding to the active election phase

## 0.2.4

- Remove election configuration files from server, as these are expected to be hosted statically elsewhere.

## 0.2.3

- Fix unicode escape error from postgres by storing encrypted ballots as `BYTEA` instead of `JSONB`.

## 0.2.2

- Update concordium rust dependencies

## 0.2.1

- Support TLS in docker images.

## 0.2.0

- Add --version flag to indexer and election-server.
- Update electionguard.
- Enable querying for delegations related to a specific account.
- Add option to serve a directory holding the metadata for a set of candidates from election-server.
