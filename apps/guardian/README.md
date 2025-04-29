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

**Tally phase**
- Decrypt and publish share of the election tally
- Generate and publish proof of correct decryption

## Installation

Assuming the project has already been cloned, installation of the dependencies required to build/run the project is done
by executing the following:

```bash
yarn install
```

## Build configuration

### Optional configuration

The following environment variables can be provided optionally:

```env
CCD_ELECTION_REQUEST_TIMEOUT_MS=5000 # Defaults to 5000
```

## Development workflow

To run the project during development, the following will provide a workflow with hot module replacement:

```bash
yarn tauri-dev
```

A development version of the application should now launch on the host machine.

## Building for production

To build the application for production use, do:

```bash
yarn tauri-build
```

This produces an application package/binary corresponding to the host operating system.

### Signing the application

Please follow the instructions provided by the official tauri docs with regards to signing applications for the
respective platforms:

- [MacOS](https://tauri.app/v1/guides/distribution/sign-macos)
- [Windows](https://tauri.app/v1/guides/distribution/sign-windows#c-prepare-variables)

## Bump application version

- Bump version in `./src-tauri/tauri.conf.json` and correspondingly `./package.json` (the latter is mostly for good
measure and is not strictly necessary)
- Update the latest version in `CHANGELOG.md`
