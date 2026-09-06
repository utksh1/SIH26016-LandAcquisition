# syntax=docker/dockerfile:1.7
###############################################################################
# LandFlow Full-Stack Production Dockerfile
# Stage 1: Build React Vite SPA (apps/web)
# Stage 2: Build Rust Axum API (services/api)
# Stage 3: Runtime Debian-slim container running API + serving SPA + applying DB migrations
###############################################################################

# -----------------------------------------------------------------------------
# Stage 1: Frontend Builder
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app

# Copy frontend dependencies manifest
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
WORKDIR /app/apps/web
RUN npm ci

# Copy frontend source and build production bundle
COPY apps/web/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Backend Builder
# -----------------------------------------------------------------------------
FROM rust:bookworm AS backend-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY Cargo.toml Cargo.lock* ./
COPY services/ ./services/
COPY db/ ./db/

RUN cargo build --release --bin sih-api && \
    cp /build/target/release/sih-api /build/sih-api-binary

# -----------------------------------------------------------------------------
# Stage 3: Production Runtime
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    postgresql-client \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled Rust binary
COPY --from=backend-builder /build/sih-api-binary /usr/local/bin/sih-api

# Copy static frontend bundle for axum fallback serving
COPY --from=frontend-builder /app/apps/web/dist /app/dist

# Copy migrations and seeds
COPY db/migrations /app/db/migrations
COPY db/seeds /app/db/seeds

# Copy entrypoint script
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV FRONTEND_DIST=/app/dist
ENV RUST_LOG=info
ENV BIND_ADDR=0.0.0.0:3000

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["sih-api"]
