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
  The output of this command is a CSV file used in the `final-weights` command.
  
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
election-coordinator --node http://localhost:20001 initial-weights  --start 2024-01-01T00:00:00Z --end 2024-01-03T00:00:00Z --out initial-weights.csv
```

The weights are stored in the `initial-weights.csv` file.

### Get the final weights


```console
election-coordinator --node http://localhost:20001 final-weights --contract '<7795,0>' --initial-weights initial-weights.csv --final-weights final-weights.csv
```

To take the output of the previous command (`initial-weights.csv`) and compute final weights, outputting the result to `final-weights.csv`.


### Tally the votes and register the encrypted tally in the contract

```
election-coordinator --node http://localhost:20001 tally --contract '<7795,0>' --final-weights final-weights.csv --admin-keys ../test-scripts/keys/2yJxX711aDXtit7zMu7PHqUMbtwQ8zm7emaikg24uyZtvLTysj.export
```

The same command without the `--admin-keys` will tally the votes and check that the tally matches what is registered in the contract.

### Decrypt the final result

```console
election-coordinator  --node http://localhost:20001 final-result --contract '<7795,0>' --admin-keys ../test-scripts/keys/2yJxX711aDXtit7zMu7PHqUMbtwQ8zm7emaikg24uyZtvLTysj.export```

This will look up all the decryption shares provided by the guardians, check that they are valid, and if there are enough of the valid ones it will decrypt the final result and publish it in the contract.

If the `admin-keys` are not provided the command will do everything else as with the keys, except it will check if the result in the contract matches or not, and report the result.
