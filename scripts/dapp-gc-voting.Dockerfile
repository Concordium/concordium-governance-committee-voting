# This dockerfile is meant to be run from the **root of the repository**.

ARG build_image=node:18.14-slim
ARG rust_version=1.81
ARG rust_base_image=rust:${rust_version}

FROM --platform=linux/amd64 ${rust_base_image} AS backend

WORKDIR /build
COPY . .

RUN cargo build --release --locked -p election-server --bin http

FROM --platform=linux/amd64 ${build_image} AS frontend

# Make the argument available in this stage, with default propagating down.
ARG rust_version

# Install rust dependencies for building electionguard bindings
RUN apt-get update && apt-get install curl build-essential -y

# It's usually a bit iffy to download and run stuff.
# But we are requiring TLS, and downloading from a trusted domain.
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -t wasm32-unknown-unknown -y --no-modify-path --default-toolchain ${rust_version}
ENV PATH="${PATH}:/root/.cargo/bin"
RUN cargo install cargo-concordium

# Copy front end files and dependencies
WORKDIR /build
COPY . .

WORKDIR /build/contracts/concordium-governance-committee-election

RUN cargo concordium build --schema-embed --out concordium-out/module.wasm.v1

WORKDIR /build/apps/
# Since the voting dapp depends on most of the workspace we just build it all
# to make it simpler to maintain.
RUN yarn install && yarn build:all

FROM --platform=linux/amd64 debian:bookworm

# In order to use TLS when connecting to the node we need certificates.
RUN apt-get update && apt-get install -y ca-certificates

COPY --from=backend /build/target/release/http /election-server
COPY --from=frontend /build/apps/voting/dist /dist

CMD /election-server --frontend-dir /dist
