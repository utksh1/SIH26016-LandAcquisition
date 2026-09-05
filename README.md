# SIH26016 LandFlow — National Land Acquisition & Management System

LandFlow is a national orchestration platform designed for the Smart India Hackathon 2026 (SIH26016). It provides a unified, cross-statute orchestration layer above legacy Indian government land systems (Bhoomi Rashi, DILRMP/Bhulekh, PFMS, and State LAMS), enforcing statutory compliance, cryptographic transparency, and multi-departmental workflow execution.

---

## Key Architectural Principles

1. **Database-Backed Integrity (Zero Mock Rule)**:
   - All projects, workflows, approvals, documents, objections, R&R tracking, and eHRMS users are persisted to PostgreSQL.
   - If `DATABASE_URL` is missing or the database is unreachable, the system returns `503 Service Unavailable`. In-memory silent fallback is permanently disabled.

2. **Evidentiary Cryptographic Audit Chain**:
   - Every statutory action, gate review, document upload, and objection disposal is recorded into the PostgreSQL `audit_log` table.
   - Entries are chained via SHA-256 (`row_hash = SHA256(seq + occurred_at + action + entity_id + payload + previous_hash)`). The audit ledger survives server restarts and can be mathematically audited at `/audit/verify`.

3. **eHRMS Persona Authentication**:
   - Backed by the `users` table (`db/migrations/002_ehrms_users.sql`).
   - 10 statutory government employees (EMP001 to EMP010) across 10 statutory departments (Collector, Revenue Officer, GIS Officer, Finance Officer, R&R Officer, NHAI Requiring Body, SIA Unit, Additional Collector, Legal Cell, and Central Reviewer).

4. **15-Stage RFCTLARR Act 2013 Workflow Engine**:
   - Implements statutory transitions from Proposal Initiation to Project Closure.
   - Enforces 4-layer statutory gate criteria: authorized role validation, mandatory document verification, statutory SLA countdown, and hash-chained audit persistence.

5. **Spatial Boundary Architecture & PostGIS Strategy**:
   - **Local MVP**: Parcel boundaries are stored as canonical GeoJSON (RFC 7946) inside PostgreSQL `JSONB` columns (`parcel.boundary_geojson`). This allows seamless, cross-platform local development and demo portability across macOS, Linux, and Windows without native C-geospatial library compile locks.
   - **Production Staging Path**: The database migration pipeline includes PostGIS extension enablement (`CREATE EXTENSION IF NOT EXISTS postgis;`). Production deployments convert the `JSONB` polygons into `geometry(Polygon, 4326)` with spatial GiST indexes for server-side `ST_Intersects`, `ST_DWithin`, and overlap conflict detection.

---

## Migration & Seed Ordering

Database migrations and seeds must be executed in the following sequential order:
1. `db/migrations/001_initial.sql` — Base schemas (`project`, `parcel`, `workflow_instance`, `audit_log`, `document`, `objection`, `affected_family`, `rr_entitlement`)
2. `db/migrations/002_ehrms_users.sql` — eHRMS user registry and demo employees (`EMP001` - `EMP010`)
3. `db/migrations/003_stage_definitions.sql` — 15 statutory stage definitions & SLAs
4. `db/migrations/004_workflow_stage_fk.sql` — Stage foreign key integrity constraints
5. `db/migrations/005_audit_and_workflow_persistence.sql` — Relaxed audit log and document metadata columns
6. `db/seeds/demo.sql` — Initial RFCTLARR 2013 corridor project, parcels, baseline families, and initial notifications

To apply all migrations and seeds:
```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/sih_lams_dev"
for f in db/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
psql "$DATABASE_URL" -f db/seeds/demo.sql
```

---

## Running the Platform Locally

### 1. Start PostgreSQL
Ensure PostgreSQL is running locally on port 5432 with database `sih_lams_dev`.

### 2. Start the Backend API (Rust / Axum)
```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/sih_lams_dev"
export SIH_DEV_AUTH_SECRET="sih-local-demo-secret-change-me"
export BIND_ADDR="127.0.0.1:3000"
cargo run -p sih-api
```
The API starts at `http://127.0.0.1:3000`. Health check:
```bash
curl http://127.0.0.1:3000/health
```

### 3. Start the Web Frontend (React / Vite)
```bash
cd apps/web
npm install
npm run dev
```
The frontend starts at `http://localhost:5173`.

---

## Automated Verification Suite

Run all backend integration tests:
```bash
cargo test --workspace
```
Run frontend production build verification:
```bash
cd apps/web && npm run build
```
