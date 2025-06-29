## Unreleased

- Added command `election-stats` which compiles a list that can be used for analyzing the election.

## 2.0.0

### Breaking changes

- Change initial weights calculation to only look at account balances for paydays

### Changes

- Bumped rust-sdk dependency to 6.0

## 1.0.0

- Add `description` argument to `new-election`
- Register parameters used to generate `initial-weights` in the election contract
- Update `initial-weights` to either `generate` or `verify` weight data through corresponding subcommands

## 0.2.4

- Parallelize the tally computation.
- Updates concordium rust dependencies

## 0.2.3

- `new-election` subcommand: Support supplying candidate metadata as paths on the host machine.
  When specified as a path, the data is registered in the contract under a url pointing to the election server.

## 0.2.2

- Support decryption when there are no votes.

## 0.2.1

- Allow overwriting encrypted tally if it is different from computed.
- Print progress bar during decryption.

## 0.2.0

- Add command for resetting finalization phase.

## 0.1.1

- Fix quorum check and error message in decryption handler.
