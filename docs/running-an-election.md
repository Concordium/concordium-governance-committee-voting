# Running an election from start to finish

This section describes the lifetime of an election and the different roles which interact during the election.

## Election roles

- **Coordinator**: A user with administrative rights in the election contract.
- **Guardian**: A user tasked with performing part of the decryption of the election tally.
- **Voter**: Any user that is eligible to submit a ballot for the election.

## Build the election contract

Follow the steps described in the [election contract documentation](../contracts/concordium-governance-committee-election/README.md).

## Setting up the election environment

The complete documentation for the `election-coordinator` tool can be found [here](../coordinator-tool/README.md), and should be used as the source of truth for the sub commands exposed by the tool.

### Gather the initial weights for each account in a timespan

```sh
election-coordinator --node http://localhost:20001 initial-weights \
  --out initial-weights.csv \
  generate
    --start 2024-01-01T00:00:00Z \
    --end 2024-01-03T00:00:00Z \
```

> **Note**: As the bottleneck for this command is querying the node, it's good to use a local node for this to avoid latency being too big of a factor with regards to the time needed to complete this.

### Create the election

```sh
election-coordinator new-election \
  --module ../contracts/concordium-governance-committee-election/concordium-out/module.wasm.v1 \
  --threshold 2 \
  --admin admin.export \
  --description 'Concordium GC election 2024'
  --election-start '2024-02-01T00:00:00Z' \
  --election-end '2024-02-07T00:00:00Z' \
  --decryption-deadline '2024-02-08T00:00:00Z' \
  --delegation-string 'delegatevote2024' \
  --out election-config \
  --voters-file initial-weights.csv \
  --voters-params-file initial-weights-params.json \
  --guardian 31bTNa42u1zZWag2bknEy7VraeJUozXsJMN1DFjQp7E5YR6a3G \
  --guardian 4PF6BH8bKvM48b8KNYdvGW6Sv3B2nqVRiMnWTj9cvaNHJQeX3D \
  --guardian 3ybJ66spZ2xdWF3avgxQb2meouYa7mpvMWNPmUnczU8FoF8cGB \
  --candidate candidate1.json \
  --candidate https://some.url/candidate2.json \
  --base-url http://localhost:8081/gc-election-2024/ # The location of the resources making up the election configuration.
```

### Set environment variables

```sh
export CCD_ELECTION_CONTRACT_ADDRESS="<8488,0>" # Should match the address written in previous step
export CCD_ELECTION_NETWORK="testnet"
export CCD_ELECTION_NODE="https://grpc.testnet.concordium.com:20000"
```

### Host election configuration resources

To match the format registered in the election contract by `election-coordinator new-election`, a directory of the following structure should be hosted at a
location corresponding to the `base-url` argument.

```
candidates/
  ... # file names matching the `candidate` paths given to `election-coordinator new-election`.
election-parameters.json
election-manifest.json
initial-weights.json
```

> The `http-server` dependency from npm is ideal for this while testing as it exposes an easy interface for this purpose.

```sh
npm install -g http-server
# cors is important, as otherwise the voting dApp cannot use the resources.
http-server <election-config> -p 8081 --cors
```

### Build the guardian desktop application

Follow the steps described in the [guardian application documentation](../apps/guardian/README.md).

### Build and start the election server

The election server consists of two independent components: 

- The `http` binary, whose responsibility is to serve the voting application and provide an API for the application.
- The `indexer` binary, whose responsibility is to traverse the chain for relevant events related to the election contract.

Please follow the instructions in the [election server documentation](../election-server/README.md) to get started.

## Election pre-voting phase

As a guardian (i.e. account holder of guardian account as registered in the contract) the [guardian desktop application](../apps/guardian)
can now be used to execute the necessary steps to generate and the keys required to perform the decryption of the tally once the election has finished.

### Generate and register guardian keys

Perform the following steps in the guardian application:

- Import guardian account(s) into the application
- Generate secret/public key-pair for guardian account(s), and await registration of peer keys.
- Generate encrypted shares for guardian account(s), and await registration of peer shares.
- Generate share of decryption key for guardian account(s), and await OK signal from peers.

## Election voting phase

Once voting opens, i.e. time passes the `election-start` as registered in the election contract, users can go to the voting dApp
(hosted by the election server `http`) and submit votes.

### Submit election ballot(s)

Perform the following steps in the voting dApp:

- Connect an account to the application through either a compatible mobile wallet (walletconnect) or the Concordium wallet for web.
- Select a set of candidates, click submit, and sign transaction in the wallet.

### Delegating voting power

Voting power can be delegated by sending a "transfer with memo" transaction to another account. The transaction has to:

- Happen within the voting window registered in the election contract
- The memo has to match the `delegation-string` registered in the election contract

## Election post-voting phase

Once the voting window has passed, the **coordinator** needs to perform a sequence of actions prior to the **guardians** being able decrypt.

> **Note:** For all the `election-coordinator` commands, the contract address specified by `--contract` should match the contract address
of the contract initialized in `election-coordinator new-election`.

### Compute final voting weights

```sh
election-coordinator final-weights \
  --contract "<8488,0>" \
  --initial-weights initial-weights.csv \
  --final-weights final-weights.csv
```

### Tally the encrypted ballots

```sh
election-coordinator tally --contract "<8488,0>" --final-weights final-weights.csv
```

Note that this step also scales the ballots by the weights given in `final-weights`.

### Decrypt the tally

In the guardian application, each guardian has to:

- Decrypt their share of the tally, register the result, and wait for peers to do the same.
- Generate a proof of correct decryption and register the proof in the contract.

### Compute and publish election result

Finally, the election coordinator must compute the election result from the decryption shares registered by each guardian:

```sh
election-coordinator final-result --contract '<8488,0>' --admin-keys admin.export
```
