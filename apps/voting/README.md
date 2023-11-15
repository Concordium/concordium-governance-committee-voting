# Concordium governance committee voting dApp

## Application functionality

-   Users connect through concordium wallet
-   Users (re-)cast votes by selecting from a list of candidates from election contract instance
-   Users can follow the progress of their vote

## Installation

Assuming the project has already been cloned, installation of the dependencies required to build/run the project is done
by executing the following:

```bash
yarn install
```

## Development workflow

To run the project during development, the following will provide a workflow with hot module replacement:

```bash
yarn dev
```

A development server is started, which can be accessed at the url logged in the console (usually http://localhost:5173).

## Building for production

To build the application for production use, do:

```bash
yarn build
```

Subsequently, the production build can be previewed by running:

```bash
yarn preview
```

A web server will start, which can be accessed at the url logged in the console (usually http://localhost:4173).
