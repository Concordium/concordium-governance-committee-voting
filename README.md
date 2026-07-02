# concordium-governance-committee-voting

This repository contains the different components for runnning a Concordium governance committtee election. The source code is rust and typescript.

## Dependencies

The dependencies needed on the host machine to build and run the different components included in the repository are:

- Rust (version specified in ./.github/workflows/check-crates.yaml)
- NodeJS (version specified in ./.github/workflows/check-apps.yml)
- Yarn

## Docker Compose for election server + indexer

A ready-to-use compose setup is provided in `docker-compose.election.yml`. It runs:

- `postgres`
- `indexer`
- `http`

The election target is configured through environment variables, primarily:

- `CCD_ELECTION_CONTRACT_ADDRESS`
- `CCD_ELECTION_NETWORK`
- `CCD_ELECTION_NODE_ENDPOINT`

These are required and intentionally have no defaults in the compose file.

An example configuration is provided in `env.election.example`.

By default, no Docker platform is specified. If you want to force a platform locally, use the optional override file `docker-compose.election.platform.yml` together with `CCD_ELECTION_DOCKER_PLATFORM`.

The Dockerfiles also support CI builds that pass `DOCKER_PLATFORM` as a build argument. If it is unset, they fall back to Docker's normal target platform.

Typical usage:

```bash
cp env.election.example .env
# edit .env as needed

docker compose up --build -d
```

The HTTP server is then available on `http://localhost:8080` by default.

If Docker runs out of memory while building, build the images sequentially as shown above. The Dockerfiles also limit Cargo to a single build job to reduce memory usage.
