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

5. **Spatial Boundary Architecture & PostGIS**:
   - PostGIS extension is enabled (migration 006). Parcel boundaries are stored as native `geometry(Polygon, 4326)` with GiST spatial indexes on `parcel.boundary`, `parcel.centroid`, and `project.alignment`.
   - Supports `ST_Intersects`, `ST_DWithin`, `ST_Contains` for cadastral overlay and spatial conflict detection per Master PDF §37.

---

## Migration & Seed Ordering

Database migrations and seeds must be executed in the following sequential order:
1. `db/migrations/001_initial.sql` — Base schemas (`project`, `parcel`, `workflow_instance`, `audit_log`, `document`, `objection`, `affected_family`, `rr_entitlement`)
2. `db/migrations/002_ehrms_users.sql` — eHRMS user registry and demo employees (`EMP001` - `EMP010`)
3. `db/migrations/003_legal_workflow_engine.sql` — 15 statutory stage definitions, 10 departments, 11 stakeholder roles
4. `db/migrations/004_workflow_instance_fk.sql` — Link `workflow_instance.current_stage` to `workflow_stage_definition(stage_code)`
5. `db/migrations/005_audit_and_workflow_persistence.sql` — Relaxed audit log, approval history, document, and objection columns for all 11 roles
6. `db/migrations/006_reenable_postgis.sql` — Re-enable PostGIS extension, convert JSONB geometry columns to native `geometry(Polygon/Point, 4326)` with GiST indexes
7. `db/migrations/007_ownership_status.sql` — `ownership_status` enum (`clear|disputed|untraceable|under_litigation|multiple_claimants`) + `deposit_with_authority` table for Section 77 / 3H(2) escrow sub-flow
8. `db/migrations/008_process_type_branches.sql` — Seed 3 demo projects for `right_of_user`, `govt_allotment`, `land_pooling` process types
9. `db/migrations/009_larr_workflow_gates.sql` — Seed 19 LARR workflow_gate rows (15 hard statutory gates + 4 soft advisory gates) for all 14 stage transitions
10. `db/migrations/010_unify_user_role_mapping.sql` — Expand `role_code` enum to 12 statutory roles, map eHRMS employees to RBAC `user_role_assignment`
11. `db/seeds/demo.sql` — Initial RFCTLARR 2013 corridor project, parcels, baseline families, and initial notifications
12. `db/fixtures/workflow.sql` — NH Act workflow_gate seed rows

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
