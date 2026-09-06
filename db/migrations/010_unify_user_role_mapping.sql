-- Migration 010: Unify eHRMS user / SIH26016 RBAC role mapping
-- =====================================================================================
-- PROBLEM (two-table drift)
--   1. `users` (migration 002) is the eHRMS-synced employee table. Its `role`
--      column is a free-text VARCHAR holding the eHRMS-side designation
--      (COLLECTOR, GIS_OFFICER, SIA_OFFICER, REHABILITATION_OFFICER, ...).
--   2. `app_user` + `user_role_assignment` (migration 001) is the SIH26016 RBAC
--      side. The `role_code` enum originally had only 4 values
--      (admin, collector, revenue_officer, land_owner).
--
--   => 6 of the 10 demo eHRMS employees (GIS_OFFICER, FINANCE_OFFICER,
--      SIA_OFFICER, REHABILITATION_OFFICER, LEGAL_OFFICER, GOVERNMENT_REVIEWER,
--      ADDITIONAL_COLLECTOR, LAND_REQUIRING_BODY) cannot be authorized through
--      the RBAC system because their `users.role` string has no matching value
--      in the `role_code` enum.
--
-- FIX (three steps)
--   A. Expand `role_code` enum to all 11 statutory SIH26016 roles
--      (12 active variants in services/domain/src/lib.rs::Role minus land_owner
--      which already exists = 8 new enum values; admin/collector/revenue_officer
--      already exist). Postgres ALTER TYPE ... ADD VALUE cannot run inside a
--      transaction block, so these run BEFORE BEGIN/COMMIT (each statement is
--      its own implicit transaction).
--   B. Insert the 8 new rows into `app_role` (role labels), insert the 5 missing
--      rows into `app_permission` (001 only seeded 11 of the 16 referenced
--      codes — needed before role_permission FKs can resolve), and grant each
--      new role a sensible permission subset.
--   C. Add an `app_user_id` UUID FK column on `users`, back-fill it with one
--      `app_user` row per eHRMS employee (idempotent: only for rows where
--      app_user_id IS NULL), then seed `user_role_assignment` rows that map
--      each eHRMS `users.role` VARCHAR → the corresponding `role_code` enum
--      value.
--
-- PHILOSOPHY (per eHRMS Authentication Architecture doc §2)
--   eHRMS answers Who (identity); SIH26016 answers What (authorization).
--   `users.role` stays as the eHRMS-side designation (the "Who"); the new
--   `user_role_assignment` rows are the SIH26016-side authorization (the
--   "What"). The two are linked by `users.app_user_id`.
--
-- EXPECTED EFFECT (first run on a clean DB that has 001, 002, demo.sql applied)
--   - role_code enum: 4 -> 12 values (8 new)
--   - app_role: 4 -> 12 rows (8 new)
--   - app_permission: 11 -> 16 rows (5 new: owners.create, owners.update,
--     stakeholders.read, stakeholders.create, stakeholders.update)
--   - role_permission: +N rows for the 8 new roles' permission subsets
--   - users table: +1 column (app_user_id UUID, FK to app_user(id))
--   - app_user: +10 rows (emp001..emp010) — only on first run when NULL
--   - user_role_assignment: +10 rows (one per demo employee)
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- A. Expand role_code enum.
-- These ALTER TYPE statements MUST run OUTSIDE a transaction block (PostgreSQL
-- limitation: ALTER TYPE ... ADD VALUE cannot run inside BEGIN/COMMIT). Each is
-- its own implicit transaction. IF NOT EXISTS guards re-runs.
-- -------------------------------------------------------------------------------------
ALTER TYPE role_code ADD VALUE IF NOT EXISTS 'land_requiring_body';
ALTER TYPE role_code ADD VALUE IF NOT EXISTS 'additional_collector';
ALTER TYPE role_code ADD VALUE IF NOT EXISTS 'gis_officer';
ALTER TYPE role_code ADD VALUE IF NOT EXISTS 'sia_officer';
ALTER TYPE role_code ADD VALUE IF NOT EXISTS 'legal_officer';
ALTER TYPE role_code ADD VALUE IF NOT EXISTS 'finance_officer';
ALTER TYPE role_code ADD VALUE IF NOT EXISTS 'rr_officer';
ALTER TYPE role_code ADD VALUE IF NOT EXISTS 'government_reviewer';

BEGIN;

-- -------------------------------------------------------------------------------------
-- B0. Ensure the demo tenant exists. demo.sql inserts this row, but to make
--     migration 010 self-sufficient (so it applies cleanly even before
--     demo.sql runs in a fresh DB), insert idempotently here.
-- -------------------------------------------------------------------------------------
INSERT INTO tenant (id, name, code)
VALUES ('00000000-0000-0000-0000-000000000001', 'SIH26016 Demo Tenant', 'SIH_DEMO')
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- B1. Insert the 8 new app_role rows. The original 4 (admin, collector,
--     revenue_officer, land_owner) were seeded by migration 001 and are kept.
-- -------------------------------------------------------------------------------------
INSERT INTO app_role (code, label) VALUES
    ('land_requiring_body',  'Land Requiring Body'),
    ('additional_collector', 'Additional Collector'),
    ('gis_officer',          'GIS Officer'),
    ('sia_officer',          'SIA Officer'),
    ('legal_officer',        'Legal Officer'),
    ('finance_officer',      'Finance Officer'),
    ('rr_officer',           'Rehabilitation Officer'),
    ('government_reviewer',  'Government Reviewer')
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- B2. Insert the 5 missing app_permission rows. Migration 001 only seeded 11
--     of the 16 permission codes referenced by this migration. The FK from
--     role_permission.permission_code -> app_permission.code means we MUST
--     insert these before granting them to roles below, otherwise the
--     role_permission inserts would fail FK validation.
-- -------------------------------------------------------------------------------------
INSERT INTO app_permission (code, label) VALUES
    ('owners.create',         'Create owners'),
    ('owners.update',         'Update owners'),
    ('stakeholders.read',     'Read stakeholders'),
    ('stakeholders.create',   'Create stakeholders'),
    ('stakeholders.update',   'Update stakeholders')
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------------------------------
-- B3. Grant each new role a sensible permission subset.
--     (admin/collector/revenue_officer/land_owner grants already exist from 001.)
--       land_requiring_body : initiate + progress own projects (LRB is the
--                            project sponsor; needs transition to advance its
--                            own projects through the workflow).
--       additional_collector : same subset as collector (delegated authority).
--       gis_officer          : survey / cadastral data capture.
--       sia_officer          : SIA prep + push projects past SIA gate.
--       legal_officer        : legal review + audit + grievance triage.
--       finance_officer      : compensation / payment progression.
--       rr_officer           : rehabilitation & resettlement tracking.
--       government_reviewer  : oversight / read-only review.
-- -------------------------------------------------------------------------------------
INSERT INTO role_permission (role_code, permission_code) VALUES
    -- land_requiring_body (7 perms)
    ('land_requiring_body', 'projects.create'),
    ('land_requiring_body', 'projects.read'),
    ('land_requiring_body', 'projects.update'),
    ('land_requiring_body', 'projects.transition'),
    ('land_requiring_body', 'parcels.read'),
    ('land_requiring_body', 'parcels.create'),
    ('land_requiring_body', 'stakeholders.read'),

    -- additional_collector (8 perms — mirrors collector)
    ('additional_collector', 'projects.create'),
    ('additional_collector', 'projects.read'),
    ('additional_collector', 'projects.update'),
    ('additional_collector', 'projects.transition'),
    ('additional_collector', 'parcels.create'),
    ('additional_collector', 'parcels.read'),
    ('additional_collector', 'parcels.update'),
    ('additional_collector', 'owners.read'),

    -- gis_officer (4 perms)
    ('gis_officer', 'projects.read'),
    ('gis_officer', 'parcels.read'),
    ('gis_officer', 'parcels.create'),
    ('gis_officer', 'parcels.update'),

    -- sia_officer (5 perms)
    ('sia_officer', 'projects.read'),
    ('sia_officer', 'projects.update'),
    ('sia_officer', 'projects.transition'),
    ('sia_officer', 'parcels.read'),
    ('sia_officer', 'owners.read'),

    -- legal_officer (7 perms)
    ('legal_officer', 'projects.read'),
    ('legal_officer', 'projects.update'),
    ('legal_officer', 'parcels.read'),
    ('legal_officer', 'owners.read'),
    ('legal_officer', 'stakeholders.read'),
    ('legal_officer', 'audit.read'),
    ('legal_officer', 'grievances.create'),

    -- finance_officer (5 perms)
    ('finance_officer', 'projects.read'),
    ('finance_officer', 'projects.update'),
    ('finance_officer', 'projects.transition'),
    ('finance_officer', 'parcels.read'),
    ('finance_officer', 'owners.read'),

    -- rr_officer (5 perms)
    ('rr_officer', 'projects.read'),
    ('rr_officer', 'projects.update'),
    ('rr_officer', 'parcels.read'),
    ('rr_officer', 'owners.read'),
    ('rr_officer', 'stakeholders.read'),

    -- government_reviewer (5 perms)
    ('government_reviewer', 'projects.read'),
    ('government_reviewer', 'parcels.read'),
    ('government_reviewer', 'owners.read'),
    ('government_reviewer', 'stakeholders.read'),
    ('government_reviewer', 'audit.read')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------------------
-- C1. Link the eHRMS-synced `users` table to the RBAC `app_user` table.
--     Add an `app_user_id` FK column (SET NULL on app_user delete so an
--     accidentally-deleted app_user doesn't cascade-destroy the eHRMS employee
--     record). Idempotent via IF NOT EXISTS.
-- -------------------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS app_user_id UUID
    REFERENCES app_user(id) ON DELETE SET NULL;

-- Unique partial index: two eHRMS employees cannot share the same app_user,
-- but NULL is allowed (un-linked employees).
CREATE UNIQUE INDEX IF NOT EXISTS users_app_user_id_uidx
    ON users (app_user_id)
    WHERE app_user_id IS NOT NULL;

-- -------------------------------------------------------------------------------------
-- C2. Create one app_user row per eHRMS employee (only for employees not yet
--     linked) and back-fill users.app_user_id. Idempotent: WHERE app_user_id
--     IS NULL guards re-runs (no new app_user is created for already-linked
--     employees). Username = lower(employee_id) e.g. 'emp001', email is a
--     deterministic eHRMS alias. Both app_user UNIQUE (tenant_id, username)
--     and UNIQUE (tenant_id, email) are satisfied because emp001..emp010 do
--     not collide with demo.sql's admin01/collector01/revenue01/owner01.
--
--     The WITH ... INSERT ... RETURNING + UPDATE pattern is a PostgreSQL
--     idiom: the CTE's INSERT runs first and returns the new app_user rows,
--     then the outer UPDATE joins them back to the users table on
--     employee_id = upper(username) (round-trips EMP001 -> emp001 -> EMP001).
-- -------------------------------------------------------------------------------------
WITH new_app_users AS (
    INSERT INTO app_user (tenant_id, username, display_name, email, password_hash)
    SELECT
        '00000000-0000-0000-0000-000000000001',
        lower(u.employee_id),
        u.name,
        lower(u.employee_id) || '@ehrms.gov.in',
        NULL
    FROM users u
    WHERE u.app_user_id IS NULL
    RETURNING id, username
)
UPDATE users u
SET app_user_id = nau.id
FROM new_app_users nau
WHERE u.employee_id = upper(nau.username)
  AND u.app_user_id IS NULL;

-- -------------------------------------------------------------------------------------
-- C3. Seed user_role_assignment: map each eHRMS `users.role` VARCHAR to the
--     corresponding SIH26016 `role_code` enum value. Falls back to 'admin' for
--     any unmapped eHRMS role string (defensive — flagged for manual audit).
--     Default scope is 'national'; production deployments would set
--     per-employee state/district/project scope.
--
--     On first run with the demo data from migration 002 (10 employees),
--     exactly 10 rows are inserted (one per employee). On re-runs, 0 new rows
--     because of UNIQUE (user_id, role_code, scope_level, scope_code,
--     valid_from) + ON CONFLICT DO NOTHING.
-- -------------------------------------------------------------------------------------
INSERT INTO user_role_assignment (user_id, role_code, scope_level, scope_code, valid_from)
SELECT
    u.app_user_id,
    CASE u.role
        WHEN 'COLLECTOR'              THEN 'collector'::role_code
        WHEN 'REVENUE_OFFICER'        THEN 'revenue_officer'::role_code
        WHEN 'GIS_OFFICER'            THEN 'gis_officer'::role_code
        WHEN 'FINANCE_OFFICER'        THEN 'finance_officer'::role_code
        WHEN 'REHABILITATION_OFFICER' THEN 'rr_officer'::role_code
        WHEN 'LAND_REQUIRING_BODY'    THEN 'land_requiring_body'::role_code
        WHEN 'SIA_OFFICER'            THEN 'sia_officer'::role_code
        WHEN 'LEGAL_OFFICER'          THEN 'legal_officer'::role_code
        WHEN 'ADDITIONAL_COLLECTOR'   THEN 'additional_collector'::role_code
        WHEN 'GOVERNMENT_REVIEWER'    THEN 'government_reviewer'::role_code
        ELSE 'admin'::role_code  -- defensive fallback; audit any unmatched role
    END,
    'national',
    NULL,
    CURRENT_DATE
FROM users u
WHERE u.app_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------------------------------
-- C4. Document the new column on users for future maintainers.
-- -------------------------------------------------------------------------------------
COMMENT ON COLUMN users.app_user_id IS
    'FK to app_user(id). Links the eHRMS-synced employee record to the SIH26016 RBAC user. '
    'eHRMS answers Who (identity); app_user + user_role_assignment answers What (authorization). '
    'Per eHRMS Authentication Architecture doc §2.';

COMMIT;
