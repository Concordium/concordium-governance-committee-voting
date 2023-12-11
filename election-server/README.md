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

Usage: http [OPTIONS] --eligible-voters-file <ELIGIBLE_VOTERS_FILE>

Options:
      --node <NODE_ENDPOINT>
          The endpoints are expected to point to concordium node grpc v2 API's. [env: CCD_ELECTION_NODE=] [default: http://localhost:20001]
      --db-connection <DB_CONNECTION>
          A connection string detailing the connection to the database used by the application. [env: CCD_ELECTION_DB_CONNECTION=] [default: "host=localhost dbname=gc-election user=postgres password=password port=5432"]
      --db-pool-size <POOL_SIZE>
          Maximum size of the database connection pool [env: CCD_ELECTION_DB_POOL_SIZE=] [default: 16]
      --log-level <LOG_LEVEL>
          Maximum log level [env: CCD_ELECTION_LOG_LEVEL=] [default: info]
      --request-timeout <REQUEST_TIMEOUT>
          The request timeout of the http server [env: CCD_ELECTION_REQUEST_TIMEOUT=] [default: 5000]
      --listen-address <LISTEN_ADDRESS>
          Address the http server will listen on [env: CCD_ELECTION_LISTEN_ADDRESS=] [default: 0.0.0.0:8080]
      --eligible-voters-file <ELIGIBLE_VOTERS_FILE>
          A json file consisting of the list of eligible voters and their respective voting weights [env: CCD_ELECTION_ELIGIBLE_VOTERS_FILE=]
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
