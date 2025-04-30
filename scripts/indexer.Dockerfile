# This dockerfile is meant to be run from the **root of the repository**.
# It builds a docker image that contains the indexer.

ARG rust_version=1.81
ARG rust_base_image=rust:${rust_version}

FROM --platform=linux/amd64 ${rust_base_image} AS backend

WORKDIR /build
COPY . .

RUN cargo build --release -p election-server --bin indexer --locked

FROM --platform=linux/amd64 debian:buster

# In order to use TLS when connecting to the node we need certificates.
RUN apt-get update && apt-get install -y ca-certificates

COPY --from=backend /build/target/release/indexer /indexer

CMD /indexer
