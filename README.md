# SIH26016 LandFlow

This repository contains the SIH26016 land acquisition workflow implementation.

## Local Compose stack

The small local stack runs PostGIS and non-production API/frontend placeholders. The placeholders are intentionally not the Rust API or Vite app; they only make the service endpoints discoverable while infrastructure is developed.

1. Copy `.env.example` to `.env` and adjust local ports or values if needed.
2. Validate the Compose file without starting services:

   ```bash
   make compose-config
   ```

3. Start the local stack:

   ```bash
   make dev-up
   ```

4. Stop services while retaining the Postgres volume:

   ```bash
   make dev-down
   ```

PostGIS is exposed on `localhost:5432`, the API placeholder on `http://localhost:8080/health`, and the frontend placeholder on `http://localhost:5173/`. On first database initialization, the Compose stack applies `db/migrations/001_initial.sql`, `db/seeds/demo.sql`, and `db/fixtures/workflow.sql` in that order. Existing database volumes are not reinitialized automatically.

## Actual applications

The Rust API is under `services/api`; its current implementation uses an in-memory repository and requires `SIH_DEV_AUTH_SECRET`. The Vite frontend is under `apps/web`. Their own build and run instructions remain in their respective project files.
