# Concordium governance committee guardian application

## Application functionality

Allows guardians of concordium governance committee elections to perform actions required to partake in necessary
ceremonies:

**Setup phase**
The application is used to perform the following steps in the setup phase of the election:

1. Generate guardian key pair, register public part in election contract
2. Generate encrypted shares of guardian secret key and register these in election contract
3. Generate share of secret key used to decrypt the election result, register successful validation of peers in contract

Steps 2 and 3 include validation of peer submissions. If these fail, complaints are registered in the contract instead
of the expected result.

**Finalization phase**
- Decrypt and publish share of the election tally

## Installation

Assuming the project has already been cloned, installation of the dependencies required to build/run the project is done
by executing the following:

```bash
yarn install
```

## Build configuration

Building for both development and production will fail if the correct environment variables are not set:

```env
CCD_ELECTION_NETWORK="testnet" # The network name. This is not strictly needed, but will show the user which network is shown to the user in the UI.
CCD_ELECTION_CONTRACT_ADDRESS="<8011,0>" # Specify the contract address to target
CCD_ELECTION_NODE="https://grpc.testnet.concordium.com:20000" # The node to use for queries
```

### Optional configuration

The following environment variables can be provided optionally:

```env
CCD_ELECTION_REQUEST_TIMEOUT_MS=5000 # Defaults to 5000
```

## Development workflow

To run the project during development, the following will provide a workflow with hot module replacement:

```bash
yarn tauri dev
```

A development version of the application should now launch on the host machine.

## Building for production

To build the application for production use, do:

```bash
yarn tauri build
```

This produces an application package/binary corresponding to the host operating system.
