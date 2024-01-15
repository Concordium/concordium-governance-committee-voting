# Concordium governance committee guardian application

## Application functionality

Allows guardians of concordium governance committee elections to perform actions required to partake in necessary
ceremonies:

**Setup phase**
- Generate part of joint key used for ballot encryption and verification
- Generate encrypted share of joint key used for election tally decryption

**Finalization phase**
- Decrypt and publish share of the election tally

## Installation

Assuming the project has already been cloned, installation of the dependencies required to build/run the project is done
by executing the following:

```bash
yarn install
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
