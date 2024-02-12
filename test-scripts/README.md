## Test scripts to facilitate end-to-end testing of the election.

This package contains test scripts to faciliate testing of the election from
contract deployment for guardians through key generation, voting, to decryption
of the result.

The script is not very configurable, but has a few options to configure the
election.

- `--module` option must point to a compile election smart contract module.
  Typically this will be
  `../contracts/concordium-governance-committee-election/concordium-out/module.wasm.v1`
  This module will be used to create a new instance of the election contract

- `--keys` **directory** with a number of keys for a number of accounts in the
  browser wallet export format. These keys are used for guardians and admin to
  update the smart contract. The script will print which key it is using for
  which purpose.

- `--num-options` the number of options to vote for.

- `--election-duration` the duration of the election in minutes.

- `--out` a directory where output artifacts are written.

Use `--help` to get further details.

## Build

To build the tool make sure you have the repository submodules initialized

```console
git submodule update --init --recursive
```

The tool can be built by running

```console
cargo build --release
```

This will produce a single binary `election-test` in `target/release` directory
which can be run for example as follows


## Run in combination with the coordinator tool

To run the script use for example the following command

```
cargo run --release -- --module ../contracts/concordium-governance-committee-election/concordium-out/module.wasm.v1 --keys keys/ --out run1 --node http://node.testnet.concordium.com:20000
```

assuming the wallet exports are in the `keys` directory.

This will create a fresh directory `run1` that will contain the generated election manifest and election parameters, as well as guardian secret keys.

The script will generate all the data in the contract and wait for the election to start and then vote randomly
with all the accounts in the `keys` directory.

```
...
Waiting for 54 seconds for the election to start
Voter 3ZXxNC4McrJJs3K3U38Av1wsnKvCxtg1bW4WxcDhy7JSCshyZw voting [0, 0, 1, 1, 0]
Submitted vote for 3ZXxNC4McrJJs3K3U38Av1wsnKvCxtg1bW4WxcDhy7JSCshyZw with transaction hash 921e648d32bc7261b4bc1344d023e436da134450e53a51be0d11b675b77346b2
Voter 4PF6BH8bKvM48b8KNYdvGW6Sv3B2nqVRiMnWTj9cvaNHJQeX3D voting [1, 1, 0, 1, 0]
Submitted vote for 4PF6BH8bKvM48b8KNYdvGW6Sv3B2nqVRiMnWTj9cvaNHJQeX3D with transaction hash 98dc64f03141c3916fc431ac5c9f3e840c73497db046460fbb9ebc4b80d57f21
Voter 2yJxX711aDXtit7zMu7PHqUMbtwQ8zm7emaikg24uyZtvLTysj voting [1, 0, 0, 0, 0]
Submitted vote for 2yJxX711aDXtit7zMu7PHqUMbtwQ8zm7emaikg24uyZtvLTysj with transaction hash fa1fa0c0bb4341e1e06fdafb0a84b861ff83dfa69da501d55be45ff51841e7fa
Voter 31bTNa42u1zZWag2bknEy7VraeJUozXsJMN1DFjQp7E5YR6a3G voting [1, 0, 0, 0, 1]
Submitted vote for 31bTNa42u1zZWag2bknEy7VraeJUozXsJMN1DFjQp7E5YR6a3G with transaction hash 28830c316abb6804187d9636c5a4d67eb9ccfe843ddc872d6efb4d7b638b66b1
Voter 45uSpzFQuhtAH2E5vQWiErrmGgxM1SFZERpxvN8gGCsuicbope voting [0, 1, 1, 1, 1]
Submitted vote for 45uSpzFQuhtAH2E5vQWiErrmGgxM1SFZERpxvN8gGCsuicbope with transaction hash 5221cceeb84119028483d705d949d8acbf69f5f9c5368ce5cc5e726a7cd86c89
Voter 4bHFGdYhexcVeFUyxtecVdVHw4cHJahN83VbRRFGy2BLqVv7mT voting [1, 1, 1, 0, 0]
Submitted vote for 4bHFGdYhexcVeFUyxtecVdVHw4cHJahN83VbRRFGy2BLqVv7mT with transaction hash 31a081d7ae6da69f098ce2fab75d4f19401e06aaf7ef971f3f2c234ff9235cad
...
```

After this the tool will wait for the election to end at which point it waits for the encrypted tally to be posted by the coordinator.

To use the coordinator tool the parameters and election manifest must be hosted in the URLs defined by the script.
This is easiest to achieve by serving the `run1` (or a directory specified when running the script) on port `7000`.
If another port is desired modify the script.

```console
python3 -m http.server 7000 -d run1
```

After that the tally command can be run as follows.
```console
cargo run --release -- tally --contract '<7735,0>' --final-weights final-weights.csv --node http://node.testnet.concordium.com:20000 --admin-keys ../test-scripts/keys/4bHFGdYhexcVeFUyxtecVdVHw4cHJahN83VbRRFGy2BLqVv7mT.export
```

modifying the `--contract` address to match the one created by the script which is emitted at the beginning, e.g.,
```
Successfully initialized contract in block e1d6f983cb8e39fa5dfa7dff62bc5664ba4bf374c92c24ca050825ca310819a7, with address <7735,0>.
```
and the `--admin-keys` as appropriate.

At this point the script posts the decryption of the tally, together with a proof of correct decryption for each guardian.
Each guardian also verifies that proofs posted by all other guardians are correct.

The final result can be posted by the coordinator tool after the script terminates.

## Run in combination with election server and indexer

Set up the election with all files generated in `run1` directory

```console
cargo run -- --module
../contracts/concordium-governance-committee-election/concordium-out/module.wasm.v1 --keys keys/ --out ../hosted-test --candidates-dir ../resources/config-example/candidates/ --base-url http://localhost:3000 --election-duration 100000
```

This will make all voters eligible to vote with equal weight. If you already have a file with eligible voters then you may supply it with `--eligible-voters` and it will be used instead.
The candidates are taken to be all the JSON files in the supplied `--candidates-dir`.

Then start the election server (from inside the [election-server](../election-server) directory)

```console
cargo run --bin http -- --contract-address '<7868,0>' --election-manifest-file ../hosted-test/static/electionguard/election-manifest.json --election-parameters-file ../hosted-test/static/electionguard/election-parameters.json --listen-address 0.0.0.0:3000  --eligible-voters-file ../hosted-test/eligible-voters.json --candidates-dir ../hosted-test/candidates/ --log-level=debug
``

modifying the `--contract-address` to the one printed by the test script in the previous step.
