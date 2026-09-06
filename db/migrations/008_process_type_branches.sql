-- Migration: 008_process_type_branches.sql
-- Description: Seed one sample project per non-default process_type so the demo
-- can show that the platform distinguishes between the four acquisition regimes
-- specified by Master PDF §14.4.
--
--   process_type            | demo project                              | seeded here
--   ------------------------+-------------------------------------------+--------------
--   compulsory_acquisition  | Delhi-Mumbai Highway Expansion            | (demo.sql, id ...100)
--   right_of_user           | Kurnool-Hyderabad Petroleum Pipeline      | yes (id ...201)
--   govt_allotment          | Kurnool Solar Park Tranche 4 (wasteland)  | yes (id ...202)
--   land_pooling            | Amaravati Capital City LPS Zone 1         | yes (id ...203)
--   consent_purchase        | (not seeded — left for future demo)      | --
--
-- The process_type enum (001_initial.sql) and project.process_type column
-- already exist; this migration only seeds demo rows so a demo operator can
-- flip between process types and observe the differing code paths (notice
-- templates, R&R applicability, solatium computation, possession mode, etc.).
-- No new enum types are created.
--
-- Tenant: '00000000-0000-0000-0000-000000000001' (SIH_DEMO tenant from demo.sql).
--
-- Geometry: native PostGIS via ST_GeomFromText('POLYGON((...))', 4326) and
-- ST_SetSRID(ST_Point(lon, lat), 4326) — no JSONB casts (migration 006
-- converted these columns back to native geometry types).
--
-- Note on workflow_stage for the solar project (id ...202): the task spec
-- named stage 'award_generation', but that value is a project_status enum
-- (used for project.status), NOT a workflow_stage_definition.stage_code.
-- Migration 004_workflow_instance_fk.sql added a hard FK from
-- workflow_instance.current_stage -> workflow_stage_definition(stage_code),
-- so 'award_generation' would fail INSERT. The semantically closest legal
-- stage seeded by migration 003 is 'award_preparation' (ordinal 9, under
-- RFCTLARR Act 2013 §23 award preparation). That is what we use here so the
-- migration applies cleanly; project.status remains 'award_generation' as
-- instructed.
--
-- Idempotent: every INSERT uses ON CONFLICT DO {NOTHING | UPDATE} so re-running
-- is safe.

BEGIN;

-- ============================================================================
-- (1) Right-of-User project — Petroleum & Minerals Pipelines Act
--     process_type = 'right_of_user'
--     Pipeline corridor where the acquiring authority takes only a sub-surface
--     / surface easement; land title remains with the owner.
-- ============================================================================
INSERT INTO project (
    id, tenant_id, name, authority, process_type, requiring_body,
    state_code, district_code, status, budget_paise
) VALUES (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    'Kurnool-Hyderabad Petroleum Pipeline Corridor',
    'larr',
    'right_of_user',
    'HPCL',
    'AP',
    'KUR',
    'notification',
    84000000000
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parcel (
    id, tenant_id, project_id, survey_number, ulpin, area_hectares,
    status, district_code, boundary, centroid
) VALUES (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000201',
    'KPL/2026/SN-114/7',
    '29000000000021',
    6.400000,
    'under_process',
    'KUR',
    '{"type":"Polygon","coordinates":[[[78.00,15.82],[78.10,15.82],[78.10,15.84],[78.00,15.84],[78.00,15.82]]]}'::jsonb,
    '{"type":"Point","coordinates":[78.050,15.830]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workflow_instance (id, project_id, authority, current_stage, deadline_at)
VALUES (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    'larr',
    'preliminary_notification',
    now() + interval '30 days'
)
ON CONFLICT (project_id) DO UPDATE SET current_stage = EXCLUDED.current_stage;

-- ============================================================================
-- (2) Government Allotment project — Solar Park on Wasteland
--     process_type = 'govt_allotment'
--     Government wasteland allotted directly to APGENCO for solar generation.
--     No private acquisition, no solatium, no R&R — title was already State.
-- ============================================================================
INSERT INTO project (
    id, tenant_id, name, authority, process_type, requiring_body,
    state_code, district_code, status, budget_paise
) VALUES (
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000001',
    'Kurnool Solar Park — Tranche 4 (Wasteland Allotment)',
    'larr',
    'govt_allotment',
    'APGENCO',
    'AP',
    'KUR',
    'award_generation',
    241400000000
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parcel (
    id, tenant_id, project_id, survey_number, ulpin, area_hectares,
    status, district_code, boundary, centroid
) VALUES (
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000202',
    'KSP-T4/2026/RES-08',
    '29000000000022',
    412.000000,
    'under_process',
    'KUR',
    '{"type":"Polygon","coordinates":[[[78.10,15.75],[78.20,15.75],[78.20,15.85],[78.10,15.85],[78.10,15.75]]]}'::jsonb,
    '{"type":"Point","coordinates":[78.150,15.800]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workflow_instance (id, project_id, authority, current_stage, deadline_at)
VALUES (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000202',
    'larr',
    'award_preparation',   -- closest valid stage_code (see header comment)
    now() + interval '60 days'
)
ON CONFLICT (project_id) DO UPDATE SET current_stage = EXCLUDED.current_stage;

-- ============================================================================
-- (3) Land Pooling project — Urban Development (Amaravati-style LPS)
--     process_type = 'land_pooling'
--     Landowners voluntarily pool land and receive developed plots back in
--     proportion to their contribution; no compulsory acquisition, no solatium.
-- ============================================================================
INSERT INTO project (
    id, tenant_id, name, authority, process_type, requiring_body,
    state_code, district_code, status, budget_paise
) VALUES (
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000001',
    'Amaravati Capital City — Land Pooling Scheme Zone 1',
    'larr',
    'land_pooling',
    'APCRDA',
    'AP',
    'AMR',
    'objection_period',
    180000000000
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parcel (
    id, tenant_id, project_id, survey_number, ulpin, area_hectares,
    status, district_code, boundary, centroid
) VALUES (
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000203',
    'AMR-LPS-Z1/2026/17',
    '29000000000023',
    18.600000,
    'under_process',
    'AMR',
    '{"type":"Polygon","coordinates":[[[80.48,16.50],[80.56,16.50],[80.56,16.55],[80.48,16.55],[80.48,16.50]]]}'::jsonb,
    '{"type":"Point","coordinates":[80.520,16.525]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO workflow_instance (id, project_id, authority, current_stage, deadline_at)
VALUES (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000203',
    'larr',
    'objection_period',
    now() + interval '60 days'
)
ON CONFLICT (project_id) DO UPDATE SET current_stage = EXCLUDED.current_stage;

COMMIT;
