-- Migration 011: Document visibility (RBAC) + jurisdiction scoping
-- =====================================================================================
-- PROBLEM
--   The `document` table (migration 001) has no `visibility` column. Today any
--   authenticated user in the same tenant can read any document, including
--   internal legal notes, draft valuations, and survey evidence that should
--   never be exposed to a Land Owner or to citizens.
--
--   This violates:
--     * Master PDF §29 (DPDP compliance): personal data must be minimised and
--       role-scoped; a Land Owner must not be able to enumerate documents
--       belonging to other parcels or to internal government deliberations.
--     * RBAC spec §11: document reads must be filtered by the requesting
--       user's role AND by the document's declared visibility tier.
--     * RBAC spec §12: every government employee is also jurisdiction-scoped
--       (national / state / district / tehsil / parcel); a Collector in
--       Bengaluru must NOT see documents of a project in Mysuru district.
--
-- VISIBILITY LEVELS (per spec §11)
--     public            -- gazette notifications, S-1/S-11 notices, hearing
--                         schedules. Visible to everyone, including the Land
--                         Owner (whose land is affected) and the general public
--                         once the document is published.
--     stakeholder       -- default. Visible to every stakeholder of the project
--                         (LRB, Collector, Revenue Officer, SIA, the parcel's
--                         Land Owners). NOT visible to citizens-at-large who
--                         have no stake in the project.
--     department_only   -- visible only to users whose `uploaded_by_department`
--                         matches the uploader's department (e.g. a Finance
--                         Officer's draft disbursement note stays inside the
--                         Finance Department). Used for cross-department
--                         confidentiality within the same government.
--     internal          -- visible to ANY government employee (any department,
--                         any role_code whose app_role is a government role,
--                         not a Land Owner) but NEVER to citizens / Land Owners.
--                         Use for internal deliberations that are not
--                         department-specific (e.g. project_status working
--                         notes shared across departments).
--     legal_privileged  -- Attorney-client / litigator work product. Visible
--                         ONLY to the Legal Officer role and any role with
--                         `legal_privileged.read` permission (auditors under
--                         court order). NEVER appears to a Land Owner, never
--                         appears to non-legal government staff. Per Master
--                         PDF §36 + Bar Council of India rules on legal
--                         professional privilege.
--
-- RULES ENFORCED BY APPLICATION CODE (this migration provides the schema only)
--     1. A Land Owner sees only PUBLIC + STAKEHOLDER documents for their own
--        parcels (filtered by parcel_owner join).
--     2. LEGAL_PRIVILEGED documents NEVER appear to non-legal roles, even if
--        the non-legal role is otherwise a stakeholder.
--     3. DEPARTMENT_ONLY documents are filtered by
--        `document.uploaded_by_department = current_user.department`.
--     4. INTERNAL documents are visible to any government employee but NOT to
--        Land Owners or un-authenticated citizens.
--     5. PUBLIC documents are visible to anyone (subject to project/parcel
--        tenant scoping already enforced by RLS).
--
-- JURISDICTION (per spec §12)
--   A new `jurisdiction` table records the geographic scope of each
--   government employee: national / state / district / tehsil / parcel.
--   Queries joining document -> project -> state_code/district_code AND
--   jurisdiction -> user_id will filter out documents outside the user's
--   jurisdiction. This is in addition to the role-based visibility filter.
--
-- IDEMPOTENCY
--   Every DDL uses IF NOT EXISTS or a DO-block pg_type guard. The migration
--   is safe to apply on a fresh DB (after 001 + 002) and on re-runs.
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Create document_visibility enum.
--    PostgreSQL's CREATE TYPE does not support IF NOT EXISTS, so guard with a
--    DO block that swallows the duplicate_object exception (mirrors the
--    pattern used in migration 007_ownership_status.sql).
-- -------------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE document_visibility AS ENUM (
        'public',
        'stakeholder',
        'department_only',
        'internal',
        'legal_privileged'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -------------------------------------------------------------------------------------
-- 2. Add visibility + uploader-context columns to document.
--    - visibility: NOT NULL with default 'stakeholder' so pre-existing rows
--      (and any insert that forgets to set visibility) are visible to the
--      project's stakeholders — backward compatible with the previous
--      behaviour where every document was implicitly stakeholder-visible.
--    - uploaded_by_role: the role_code (as VARCHAR, mirroring the relaxed
--      `kind` column after migration 005) of the user who uploaded the
--      document. Used to disambiguate LEGAL_PRIVILEGED uploads (only
--      legal_officer role should be able to create them).
--    - uploaded_by_department: the department name of the uploader (mirrors
--      the eHRMS `users.department` column from migration 002). Used to
--      scope DEPARTMENT_ONLY documents.
-- -------------------------------------------------------------------------------------
ALTER TABLE document ADD COLUMN IF NOT EXISTS visibility
    document_visibility NOT NULL DEFAULT 'stakeholder';
ALTER TABLE document ADD COLUMN IF NOT EXISTS uploaded_by_role VARCHAR(64);
ALTER TABLE document ADD COLUMN IF NOT EXISTS uploaded_by_department VARCHAR(64);

-- -------------------------------------------------------------------------------------
-- 3. Indexes for visibility filtering.
--    - document_visibility_idx: accelerates "list all PUBLIC documents".
--    - document_project_visibility_idx: composite index for the common query
--      "list all documents visible to role X in project Y" (filter on
--      project_id + visibility, then sort by created_at).
-- -------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS document_visibility_idx
    ON document (visibility);
CREATE INDEX IF NOT EXISTS document_project_visibility_idx
    ON document (project_id, visibility);

-- -------------------------------------------------------------------------------------
-- 4. Backfill existing documents.
--    - Default visibility (set by the column DEFAULT) is 'stakeholder' for
--      every pre-existing row.
--    - Override kind='notice' rows to 'public' so Land Owners can see the
--      gazette notifications (S-1 preliminary notification, S-11 declaration,
--      S-19 award notice) that were already uploaded under that kind in
--      migration 001's seed data and the demo.sql fixture.
--    - Override kind='survey_evidence' rows to 'department_only' so cadastral
--      survey evidence stays inside the Survey Department / Revenue Department
--      and is NOT exposed to Land Owners (per DPDP minimisation principle,
--      Master PDF §29).
--    - All other kinds (award, identity, valuation, order, other) keep the
--      'stakeholder' default — these are project-scoped working documents
--      that should be visible to the project's stakeholders but not the
--      general public.
-- -------------------------------------------------------------------------------------
UPDATE document SET visibility = 'public'         WHERE kind = 'notice';
UPDATE document SET visibility = 'department_only' WHERE kind = 'survey_evidence';

-- -------------------------------------------------------------------------------------
-- 5. Column comments for future maintainers / tooling.
-- -------------------------------------------------------------------------------------
COMMENT ON COLUMN document.visibility IS
    'Visibility tier controlling who may read this document. '
    'Values: public | stakeholder | department_only | internal | legal_privileged. '
    'Default stakeholder (visible to all project stakeholders, incl. the affected '
    'Land Owner). LEGAL_PRIVILEGED never appears to non-legal roles. '
    'Per Master PDF §29 (DPDP) + RBAC spec §11.';

COMMENT ON COLUMN document.uploaded_by_role IS
    'Role code of the user who uploaded the document (VARCHAR, mirrors the '
    'relaxed `kind` column from migration 005 — accepts any of the 12 '
    'role_code enum values post migration 010). Used to enforce that only '
    'legal_officer can create LEGAL_PRIVILEGED documents, and to scope '
    'DEPARTMENT_ONLY / INTERNAL reads by role lineage.';

COMMENT ON COLUMN document.uploaded_by_department IS
    'Department name of the uploader (mirrors the eHRMS users.department '
    'column from migration 002). Used to filter DEPARTMENT_ONLY documents '
    'so a draft Finance note is only readable inside the Finance Department, '
    'a draft Legal note inside the Legal & Litigation Cell, etc.';

-- -------------------------------------------------------------------------------------
-- 6. Jurisdiction table (per spec §12).
--    One row per (employee, scope_level, scope_code). An employee can have
--    multiple jurisdiction rows if they are scoped to multiple districts /
--    tehsils. The unique constraint on (employee_id, scope_level, scope_code)
--    makes the seed INSERT ... ON CONFLICT DO NOTHING idempotent.
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jurisdiction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_user(id) ON DELETE CASCADE,
    employee_id VARCHAR(32),   -- links to users.employee_id (eHRMS, migration 002)
    scope_level VARCHAR(16) NOT NULL CHECK (scope_level IN ('national', 'state', 'district', 'tehsil', 'parcel')),
    scope_code VARCHAR(64) NOT NULL,   -- e.g. 'KA' for state, 'BLR' for district, 'IN' for national
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jurisdiction_user_idx
    ON jurisdiction (user_id);
CREATE INDEX IF NOT EXISTS jurisdiction_employee_idx
    ON jurisdiction (employee_id);

-- Unique constraint so the seed below can use ON CONFLICT DO NOTHING. The
-- constraint is added via CREATE UNIQUE INDEX IF NOT EXISTS (the only
-- idempotent way to add a multi-column unique constraint in PG16 without a
-- DO-block). ON CONFLICT (employee_id, scope_level, scope_code) works with
-- either a unique index or a unique constraint as the arbiter.
CREATE UNIQUE INDEX IF NOT EXISTS jurisdiction_employee_scope_uidx
    ON jurisdiction (employee_id, scope_level, scope_code);

COMMENT ON TABLE jurisdiction IS
    'Geographic scope of each government employee per RBAC spec §12. '
    'A user with national scope sees all projects; state scope filters by '
    'project.state_code; district scope by project.district_code; tehsil and '
    'parcel scope are finer-grained. Joined to app_user via user_id and to '
    'eHRMS via employee_id. Multiple rows per user allowed (e.g. a Collector '
    'covering two districts).';

COMMENT ON COLUMN jurisdiction.user_id IS
    'FK to app_user(id) ON DELETE CASCADE. The SIH26016 RBAC user identity. '
    'Nullable to allow jurisdiction rows to be provisioned before the eHRMS '
    'link is back-filled.';

COMMENT ON COLUMN jurisdiction.employee_id IS
    'eHRMS employee_id (migration 002 users.employee_id). Nullable to allow '
    'jurisdiction rows for non-eHRMS RBAC users (e.g. demo admin). Either '
    'user_id or employee_id should be set; usually both.';

COMMENT ON COLUMN jurisdiction.scope_level IS
    'Geographic granularity: national | state | district | tehsil | parcel. '
    'Mirrors user_role_assignment.scope_level CHECK constraint from migration '
    '001 but adds tehsil and parcel for finer-grained parcel-level access '
    'control per spec §12.';

COMMENT ON COLUMN jurisdiction.scope_code IS
    'The code identifying the jurisdiction at scope_level granularity: '
    'national -> ISO 3166-1 alpha-2 country code (e.g. IN); '
    'state -> ISO 3166-2:IN state code (e.g. KA for Karnataka); '
    'district -> district code (e.g. BLR for Bengaluru); '
    'tehsil -> tehsil code; '
    'parcel -> parcel UUID.';

-- -------------------------------------------------------------------------------------
-- 7. Seed jurisdiction rows for the 10 demo eHRMS employees (migration 002).
--    Mapping per spec §12 + Master PDF §4 (organisational structure):
--      EMP001 Collector            -> district BLR  (Bengaluru Urban)
--      EMP002 Revenue Officer      -> district BLR
--      EMP003 GIS Officer          -> district BLR  (cadastral survey local)
--      EMP004 Finance Officer      -> district BLR  (compensation disbursement local)
--      EMP005 R&R Officer          -> district BLR  (R&R delivery local)
--      EMP006 Land Requiring Body  -> national IN   (NHAI pan-India)
--      EMP007 SIA Officer          -> district BLR
--      EMP008 Additional Collector  -> district BLR  (delegated district authority)
--      EMP009 Legal Officer        -> state KA      (state-level legal cell)
--      EMP010 Government Reviewer  -> national IN   (oversight: Appropriate Govt)
--
--    The seed INSERTs join users (eHRMS) -> app_user_id (RBAC link from
--    migration 010) so both the user_id FK and the employee_id column are
--    populated in one pass. ON CONFLICT (employee_id, scope_level, scope_code)
--    DO NOTHING keeps the seed idempotent across re-runs.
-- -------------------------------------------------------------------------------------
INSERT INTO jurisdiction (user_id, employee_id, scope_level, scope_code)
SELECT
    u.app_user_id,
    v.employee_id,
    v.scope_level,
    v.scope_code
FROM users u
JOIN (
    VALUES
        ('EMP001'::varchar, 'district'::varchar, 'BLR'::varchar),
        ('EMP002',           'district',           'BLR'),
        ('EMP003',           'district',           'BLR'),
        ('EMP004',           'district',           'BLR'),
        ('EMP005',           'district',           'BLR'),
        ('EMP006',           'national',           'IN'),
        ('EMP007',           'district',           'BLR'),
        ('EMP008',           'district',           'BLR'),
        ('EMP009',           'state',              'KA'),
        ('EMP010',           'national',           'IN')
) AS v(employee_id, scope_level, scope_code)
  ON v.employee_id = u.employee_id
WHERE u.app_user_id IS NOT NULL
ON CONFLICT (employee_id, scope_level, scope_code) DO NOTHING;

COMMIT;
