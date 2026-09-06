# syntax=docker/dockerfile:1.7
###############################################################################
# SIH26016 Rust API — multi-stage build
#
# Stage 1: builder   (rust:1.82-bookworm, builds release binary)
# Stage 2: runtime    (debian:bookworm-slim, runs the binary)
#
# Build context is the repo root (see docker-compose.yml `context: ../..`),
# so all workspace members (services/*) and db/ are available.
###############################################################################

############################
# Stage 1: builder
############################
FROM rust:1.82-bookworm AS builder

# Install build prerequisites. `pkg-config` and `libssl-dev` are required so
# the `sqlx`/`native-tls` stack (workspace Cargo.toml) can link against
# OpenSSL during the cargo build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        pkg-config \
        libssl-dev \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy the workspace manifest + lockfile first to maximise Docker layer /
# BuildKit cache reuse. Cargo.lock may not exist in a fresh checkout —
# COPY will fail if the source is missing, so we use a glob fallback below.
COPY Cargo.toml ./
# Cargo.lock is optional in source tree (cargo generates it on first build).
# Use a shell `|| true` guard via COPY of a possible file:
COPY Cargo.lock* ./

# Copy the entire workspace source tree.
COPY services/ ./services/
COPY db/ ./db/

# Build the release binary for sih-api. BuildKit cache mounts keep the
# cargo registry and the target/ dir warm across rebuilds, so the second
# `docker compose build` is fast.
# --mount=type=cache,target=/usr/local/cargo/registry  -> downloaded crates
# --mount=type=cache,target=/build/target               -> incremental build artefacts
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/build/target \
    cargo build --release --bin sih-api \
    && cp /build/target/release/sih-api /build/sih-api-binary

# The binary is copied to a stable path outside /build/target so the runtime
# stage can grab it without the cache mount (cache mounts are NOT shared
# between stages unless explicitly mounted).

############################
# Stage 2: runtime
############################
FROM debian:bookworm-slim AS runtime

# ca-certificates: TLS trust store for outbound HTTPS (Postgres native-tls).
# libssl3: runtime shared libs for the native-tls stack linked at build time.
# wget: used by the compose healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl3 \
        wget \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary from the builder stage.
COPY --from=builder /build/sih-api-binary /usr/local/bin/sih-api

# Default runtime configuration. main.rs reads BIND_ADDR (default
# 127.0.0.1:3000); we override to 0.0.0.0:3000 so the port is reachable
# outside the container's loopback interface.
ENV BIND_ADDR=0.0.0.0:3000
ENV RUST_LOG=info

EXPOSE 3000

CMD ["sih-api"]
