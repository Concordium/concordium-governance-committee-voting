# This dockerfile is meant to be run from the **root of the repository**.
# It builds a docker image that contains the indexer.

ARG rust_version=1.76
ARG rust_base_image=rust:${rust_version}-buster

FROM --platform=linux/amd64 ${rust_base_image} AS backend

WORKDIR /build
COPY ./deps/ ./deps/
COPY ./contracts/ ./contracts/
COPY ./election-common/ ./election-common/
COPY ./election-server/ ./election-server

RUN cargo build --release --bin indexer --locked --manifest-path ./election-server/Cargo.toml

FROM --platform=linux/amd64 debian:buster

# In order to use TLS when connecting to the node we need certificates.
RUN apt-get update && apt-get install -y ca-certificates

COPY --from=backend /build/election-server/target/release/indexer /indexer

CMD /indexer
