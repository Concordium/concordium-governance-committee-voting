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
