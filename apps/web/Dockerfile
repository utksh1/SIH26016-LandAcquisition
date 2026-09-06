# syntax=docker/dockerfile:1.7
###############################################################################
# SIH26016 Web Frontend — multi-stage build
#
# Stage 1: builder   (node:20-bookworm-slim, runs `npm run build`)
# Stage 2: runtime   (nginx:alpine, serves the static SPA)
#
# Build context is the repo root (see docker-compose.yml `context: ../..`),
# so the Dockerfile can read apps/web/.
###############################################################################

############################
# Stage 1: builder
############################
FROM node:20-bookworm-slim AS builder

WORKDIR /build

# Copy package manifests first to leverage layer caching for `npm ci`.
COPY apps/web/package.json apps/web/package-lock.json ./

RUN npm ci

# Copy the rest of the frontend source (src/, index.html, vite.config.ts,
# tsconfig*.json, etc.).
COPY apps/web/ ./

# Produce the production bundle in /build/dist.
# `npm run build` runs `tsc -b && vite build` per apps/web/package.json.
RUN npm run build

############################
# Stage 2: runtime
############################
FROM nginx:alpine AS runtime

# Remove the default nginx static site so only our dist lands in /usr/share/nginx/html.
RUN rm -rf /usr/share/nginx/html/*

# Copy the Vite build output into nginx's default document root.
COPY --from=builder /build/dist /usr/share/nginx/html

# Replace the default nginx server config with our SPA-aware config
# (try_files fallback to /index.html + /api/ reverse proxy).
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
