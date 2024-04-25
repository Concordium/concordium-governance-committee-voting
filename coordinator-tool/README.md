## Election coordinator tool

The `coordinator-tool` is an administrative tool to coordinate the parts of the
election that are not done by voters or guardians.

The coordinator of the election is not trusted per se. All the actions it can do
can be verified by any other party. The coordinator tool can be mostly run
without access to any secrets to verify results of the election. However some
commands take "admin keys" where the result of operations can be posted in the
contract for everybody to see. If such a result is present in the contract and
another user runs the coordinator tool, the tool will check that the result it
computed and the one posted in the contract agree.

The tool has the following subcommands

- `initial-weights` is the command used to gather the average amount of CCD on
  an account in the given period. The intention is that this command is used to
  produce the initial weights of each account prior to the election starting.
  This command has two subcommands:
  - `generate` will write the computed weights and the parameters used to generate
    these into separate files in the specified `out` directory.
    The  CSV file containing the weights will be used in the `final-weights` command.
  - `verify` verifies the weights registered in the contract by comparing the hash
    of the computed weights with the checksum registered in the contract.

- `new-election` is the command to create the necessary files and the contract
  for a new election. In particular it will
  - create a election manifest based on the inputs
  - create election parameters based on the inputs
  - create a new smart contract instance.

- `final-weights` is used to compute the final weights taking into account the
  delegation. It takes initial weights into account and any delegations during
  the election period. The output of this command is used in the `tally`
  command.

- `tally` taking into account the `final-weights` compute the encrypted tally of
  the election and optionally post it in the contract. This sums up all the
  votes during the election period and scales them according to the specified
  weights.

- `final-result` after the guardians have each decrypted their share of the
  encrypted tally this command can be used to combine the shares and post the
  result in the contract, or if the result is already posted to check that it
  matches what we compute.

All commands have a `--help` option which explains the input and output
parameters.


## Build and run

### Prerequisites

Building the tool requires Rust 1.74 or newer.

### Build

To build the tool make sure you have the repository submodules initialized

```console
git submodule update --init --recursive
```

The tool can be built by running

```console
cargo build --release
```

This will produce a single binary `election-coordinator` in `target/release` directory.


## Example commands

### Get the list of initial weights

```console
election-coordinator --node http://localhost:20001 initial-weights --out . generate --start 2024-01-01T00:00:00Z --end 2024-01-03T00:00:00Z
```

The weights are stored in the `initial-weights.csv` file, and the corresponding parameters
used to generate them in `initial-weights-params.json`.

#### Verify computation of initial weights for election

```console
election-coordinator --node http://localhost:20001 initial-weights --out . verify --contract "<8836,0>"
```

The weights are calculated based on the parameters registered in the contract, and the result is then compared with the
checksum registered in the contract.

### Create a new election instance

```
election-coordinator new-election \
  --module ../contracts/concordium-governance-committee-election/concordium-out/module.wasm.v1 
  --description 'Concordium GC election 2024' \
  --threshold 1 \
  --admin 2yJxX711aDXtit7zMu7PHqUMbtwQ8zm7emaikg24uyZtvLTysj.export \
  --election-start '2024-02-01T00:00:00Z' \
  --election-end '2024-02-07T00:00:00Z' \
  --decryption-deadline '2024-02-08T00:00:00Z' \
  --delegation-string 'This is how you delegate' \
  --out ./election-out  \
  --voters-file initial-weights.csv \
  --voters-params-file initial-weights-params.json \
  --guardian 31bTNa42u1zZWag2bknEy7VraeJUozXsJMN1DFjQp7E5YR6a3G \
  --guardian 4PF6BH8bKvM48b8KNYdvGW6Sv3B2nqVRiMnWTj9cvaNHJQeX3D \
  --candidate candidates/candidate1.json' \
  --candidate 'http://localhost:7000/candidate2.json' \
  --node 'https://grpc.testnet.concordium.com:20000' \
  --base-url https://gcvoting.testnet.concordium.com`
```

The options are the following

- `--admin` is the path to the keys that will be used to create the contract, and serve as the admin
- `--module` is the path to the compiled election smart contract in `wasm.v1` format
- `--description` is a short, descriptive title for the election
- `--threshold` is the threshold for the number of guardians needed for decryption of the result of the election
- `--election-start` and `--election-end` are clear
- `--decryption-deadline` is the time guardians must register their decryptions before
- `--delegation-string` is the string that will be used to determine vote delegations
- `--voters-file` is intended to be the `initial-weights.csv` file for the election
- `--voters-params-file` is intended to be the `initial-weights-params.json` file containing the parameters used to compute the `initial-weights`
- `--guardian` (repeated) is guardian account addresses. At least one is needed.
- `--candidate` (repeated) is a URL or a path to a candidate. The order here matters, since that will be the order
  of selections in the election. The link should be to the candidate metadata. The hash of the metadata will be
  embedded in the contract.
- `--base-url` the URL where the election server is accessible, e.g., https://gcvoting.testnet.concordium.com

The tool generates three things
- An election manifest + election parameters which are written to the directory specified by `--out`
- A new smart contract instance which is printed to stderr, for example

```
Deployed new contract instance with address <7838,0> using transaction hash 3b3e61a01fd3ecefddecbe6760c6ba3d951f4d0a8947d63990ffe9219249de27.
```

### Get the final weights


```console
election-coordinator --node http://localhost:20001 final-weights --contract '<7795,0>' --initial-weights initial-weights.csv --final-weights final-weights.csv
```

To take the output of the previous command (`initial-weights.csv`) and compute final weights, outputting the result to `final-weights.csv`.


### Tally the votes and register the encrypted tally in the contract

```
election-coordinator --node http://localhost:20001 tally --contract '<7795,0>' --final-weights final-weights.csv --admin-keys 2yJxX711aDXtit7zMu7PHqUMbtwQ8zm7emaikg24uyZtvLTysj.export
```

The same command without the `--admin-keys` will tally the votes and check that the tally matches what is registered in the contract.

### Decrypt the final result

```console
election-coordinator  --node http://localhost:20001 final-result --contract '<7795,0>' --admin-keys 2yJxX711aDXtit7zMu7PHqUMbtwQ8zm7emaikg24uyZtvLTysj.export
```

This will look up all the decryption shares provided by the guardians, check that they are valid, and if there are enough of the valid ones it will decrypt the final result and publish it in the contract.

If the `admin-keys` are not provided the command will do everything else as with the keys, except it will check if the result in the contract matches or not, and report the result.

### Reset the finalization

```console
election-coordinator --node http://localhost:20001 reset --contract '<7795,0>' --admin-keys 2yJxX711aDXtit7zMu7PHqUMbtwQ8zm7emaikg24uyZtvLTysj.export --guardian 31bTNa42u1zZWag2bknEy7VraeJUozXsJMN1DFjQp7E5YR6a3G --guardian 4PF6BH8bKvM48b8KNYdvGW6Sv3B2nqVRiMnWTj9cvaNHJQeX3D --decryption-deadline 2024-03-23T12:13:14Z
```

This will reset the finalization phase, meaning that all posted guardian decryptions and proofs will be removed in the contract state. Furthermore, the provided guardians will be excluded from posting
decryptions and proofs again. The remaining guardians (those not excluded) should post their new decryptions and proofs before the new decryption deadline set by `--decryption-deadline`.
