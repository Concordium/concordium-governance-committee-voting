# Concordium governance committee voting - Apps workspace

This directory is meant to hold the different apps used to facilitate governance committee elections.

## Applications

- [**Voting**](./voting/):
  An application eligable voters can use to cast votes for a governance committee election.

- [**Guardian**](./guardian/):
  An application the guardians of an election use to perform guardian ceremonies.

## Other packages

- [**ElectionGuard bindings**](./electionguard-bindings/):
  WASM bindings for constructing the encrypted ballots used in the various components of the Concordium GC election
  architecture

- [**ccd-bootstrap**](./ccd-bootstrap/):
  Shared theme/layout for the election applications

- [**shared**](./shared/):
  Shared logic for the election applications

## Building

The entire workspace can be built by executing the following command:

```
yarn build:all
```

---
**Note:** A prerequisite for running this successfully is, that the election contract has been built, according to [it's
documentation](../contracts/concordium-governance-committee-election/README.md).
---
