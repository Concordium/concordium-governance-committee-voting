# Election server

## Build

To build both binaries included in the project, do

```bash
cargo build --release
```

## Running the http binary

```bash
cargo run --bin http --release -- --eligible-voters-file "path/to/voters.json" # and other configration options.
```

### Configuration

Usage: http [OPTIONS] --eligible-voters-file <ELIGIBLE_VOTERS_FILE> --election-manifest-file <EG_MANIFEST_FILE> --election-parameters-file <EG_PARAMETERS_FILE> --network <NETWORK> --contract-address <CONTRACT_ADDRESS>

Options:
      --node <NODE_ENDPOINT>
          The endpoints are expected to point to concordium node grpc v2 API's. [env: CCD_ELECTION_NODE=] [default: http://localhost:20001]
      --db-connection <DB_CONNECTION>
          A connection string detailing the connection to the database used by the application. [env: CCD_ELECTION_DB_CONNECTION=] [default: "host=localhost dbname=gc-election user=postgres password=password port=5432"]
      --db-pool-size <POOL_SIZE>
          Maximum size of the database connection pool [env: CCD_ELECTION_DB_POOL_SIZE=] [default: 16]
      --log-level <LOG_LEVEL>
          Maximum log level [env: CCD_ELECTION_LOG_LEVEL=] [default: info]
      --request-timeout-ms <REQUEST_TIMEOUT_MS>
          The request timeout of the http server (in milliseconds) [env: CCD_ELECTION_REQUEST_TIMEOUT_MS=] [default: 5000]
      --listen-address <LISTEN_ADDRESS>
          Address the http server will listen on [env: CCD_ELECTION_LISTEN_ADDRESS=] [default: 0.0.0.0:8080]
      --prometheus-address <PROMETHEUS_ADDRESS>
          Address of the prometheus server [env: CCD_ELECTION_PROMETHEUS_ADDRESS=]
      --eligible-voters-file <ELIGIBLE_VOTERS_FILE>
          A json file consisting of the list of eligible voters and their respective voting weights [env: CCD_ELECTION_ELIGIBLE_VOTERS_FILE=]
      --election-manifest-file <EG_MANIFEST_FILE>
          A json file consisting of the election manifest used by election guard [env: CCD_ELECTION_ELECTION_MANIFEST_FILE=]
      --election-parameters-file <EG_PARAMETERS_FILE>
          A json file consisting of the election parameters used by election guard [env: CCD_ELECTION_ELECTION_PARAMETERS_FILE=]
      --frontend-dir <FRONTEND_DIR>
          Path to the directory where frontend assets are located [env: CCD_ELECTION_FRONTEND_DIR=] [default: ./frontend/dist]
      --allow-cors
          Allow requests from other origins. Useful for development where frontend is not served from the server [env: CCD_ELECTION_ALLOW_CORS=]
      --network <NETWORK>
          The network to connect users to (passed to frontend) [env: CCD_ELECTION_NETWORK=] [possible values: mainnet, testnet]
      --contract-address <CONTRACT_ADDRESS>
          The contract address of the election contract (passed to frontend) [env: CCD_ELECTION_CONTRACT_ADDRESS=]
  -h, --help
          Print help

## Running the indexer binary

```bash
cargo run --bin indexer --release -- --contract-address "<7357,0>" # and other configration options.
```

### Configuration

Usage: indexer [OPTIONS] --contract-address <CONTRACT_ADDRESS>

Options:
      --node <NODE_ENDPOINTS>
          The endpoints are expected to point to concordium node grpc v2 API's. [env: CCD_ELECTION_NODES=] [default: http://localhost:20001]
      --db-connection <DB_CONNECTION>
          A connection string detailing the connection to the database used by the application. [env: CCD_ELECTION_DB_CONNECTION=] [default: "host=localhost dbname=gc-election user=postgres password=password port=5432"]
      --contract-address <CONTRACT_ADDRESS>
          The contract address used to filter contract updates [env: CCD_ELECTION_CONTRACT_ADDRESS=]
      --log-level <LOG_LEVEL>
          Maximum log level [env: CCD_ELECTION_LOG_LEVEL=] [default: info]
      --max-behind-seconds <MAX_BEHIND_S>
          Max amount of seconds a response from a node can fall behind before trying another [env: CCD_ELECTION_MAX_BEHIND_SECONDS=] [default: 240]
  -h, --help
          Print help
