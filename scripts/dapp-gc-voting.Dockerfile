# This dockerfile is meant to be run from the **root of the repository**.

ARG build_image=node:18-slim
ARG rust_version=1.74
ARG rust_base_image=rust:${rust_version}-buster

FROM ${rust_base_image} AS backend

WORKDIR /build
COPY ./deps/ ./deps/
COPY ./contracts/ ./contracts/
COPY ./election-common/ ./election-common/
COPY ./election-server/ ./election-server

RUN cargo build --release --locked --bin http --manifest-path ./election-server/Cargo.toml

FROM ${build_image} AS frontend

# Make the argument available in this stage, with default propagating down.
ARG rust_version

# Install rust dependencies for building electionguard bindings
RUN apt update && apt install curl build-essential -y

# It's usually a bit iffy to download and run stuff.
# But we are requiring TLS, and downloading from a trusted domain.
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -t wasm32-unknown-unknown -y --no-modify-path --default-toolchain ${rust_version}
ENV PATH="${PATH}:/root/.cargo/bin"

# Copy front end files and dependencies
WORKDIR /build
COPY ./deps/ ./deps/
COPY ./election-common/ ./election-common/
COPY ./apps/ ./apps

WORKDIR /build/apps/
# Since the voting dapp depends on most of the workspace we just build it all
# to make it simpler to maintain.
RUN yarn install && yarn build:all

FROM debian:buster

COPY --from=backend /build/election-server/target/release/http /election-server
COPY --from=frontend /build/apps/voting/dist /dist

CMD /election-server --frontend-dir /dist
