-- SIH26016 MVP schema: PostgreSQL 16 + PostGIS.
-- Apply with: psql "$DATABASE_URL" -f db/migrations/001_initial.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE authority_code AS ENUM ('larr', 'national_highways');
CREATE TYPE project_status AS ENUM ('draft', 'land_verification', 'notification', 'objection_period', 'award_generation', 'compensation', 'possession', 'completed', 'lapsed');
CREATE TYPE parcel_status AS ENUM ('verification_pending', 'notification_pending', 'under_process', 'disputed', 'completed');
CREATE TYPE process_type AS ENUM ('compulsory_acquisition', 'right_of_user', 'land_pooling', 'govt_allotment', 'consent_purchase');
CREATE TYPE role_code AS ENUM ('admin', 'collector', 'revenue_officer', 'land_owner');
CREATE TYPE workflow_event_type AS ENUM ('created', 'advanced', 'returned', 'blocked', 'lapsed', 'completed');
CREATE TYPE payment_status AS ENUM ('pending', 'instructed', 'submitted', 'paid', 'failed', 'disputed');
CREATE TYPE document_kind AS ENUM ('notice', 'award', 'survey_evidence', 'identity', 'valuation', 'order', 'other');

CREATE TABLE tenant (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{2,32}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenant(id),
    username TEXT NOT NULL,
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    email TEXT NOT NULL CHECK (position('@' IN email) > 1),
    password_hash TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, username),
    UNIQUE (tenant_id, email)
);

CREATE TABLE app_role (
    code role_code PRIMARY KEY,
    label TEXT NOT NULL UNIQUE
);

CREATE TABLE app_permission (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL UNIQUE
);

CREATE TABLE role_permission (
    role_code role_code NOT NULL REFERENCES app_role(code) ON DELETE CASCADE,
    permission_code TEXT NOT NULL REFERENCES app_permission(code) ON DELETE CASCADE,
    PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE user_role_assignment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    role_code role_code NOT NULL REFERENCES app_role(code),
    scope_level TEXT NOT NULL CHECK (scope_level IN ('national', 'state', 'district', 'project', 'parcel')),
    scope_code TEXT,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    CHECK (valid_to IS NULL OR valid_to >= valid_from),
    UNIQUE (user_id, role_code, scope_level, scope_code, valid_from)
);

CREATE TABLE project (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenant(id),
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 200),
    authority authority_code NOT NULL,
    process_type process_type NOT NULL DEFAULT 'compulsory_acquisition',
    requiring_body TEXT NOT NULL CHECK (length(trim(requiring_body)) > 0),
    state_code TEXT NOT NULL CHECK (state_code ~ '^[A-Za-z0-9_-]{2,32}$'),
    district_code TEXT NOT NULL CHECK (district_code ~ '^[A-Za-z0-9_-]{2,64}$'),
    status project_status NOT NULL DEFAULT 'draft',
    budget_paise NUMERIC(20,0) NOT NULL DEFAULT 0 CHECK (budget_paise >= 0),
    alignment geometry(Geometry, 4326),
    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE state_subproject (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    state_code TEXT NOT NULL,
    district_code TEXT,
    status project_status NOT NULL DEFAULT 'draft',
    UNIQUE (project_id, state_code, district_code)
);

CREATE TABLE owner (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenant(id),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    contact_reference TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE parcel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenant(id),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    state_subproject_id UUID REFERENCES state_subproject(id) ON DELETE SET NULL,
    survey_number TEXT NOT NULL CHECK (length(trim(survey_number)) > 0),
    ulpin TEXT,
    area_hectares NUMERIC(14,6) NOT NULL CHECK (area_hectares > 0),
    status parcel_status NOT NULL DEFAULT 'verification_pending',
    district_code TEXT NOT NULL,
    boundary geometry(Polygon, 4326),
    centroid geometry(Point, 4326),
    source_system TEXT,
    source_retrieved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, survey_number)
);

CREATE TABLE parcel_owner (
    parcel_id UUID NOT NULL REFERENCES parcel(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES owner(id) ON DELETE CASCADE,
    interest_fraction NUMERIC(9,6) NOT NULL DEFAULT 1 CHECK (interest_fraction > 0 AND interest_fraction <= 1),
    is_disputed BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (parcel_id, owner_id)
);

CREATE TABLE stakeholder (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    stakeholder_role TEXT NOT NULL,
    contact_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE regime (
    code authority_code PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE workflow_stage (
    code TEXT PRIMARY KEY,
    authority authority_code NOT NULL,
    ordinal SMALLINT NOT NULL CHECK (ordinal >= 0),
    label TEXT NOT NULL,
    deadline_days INTEGER CHECK (deadline_days IS NULL OR deadline_days > 0),
    UNIQUE (authority, ordinal),
    UNIQUE (authority, code)
);

CREATE TABLE workflow_gate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority authority_code NOT NULL,
    from_stage TEXT NOT NULL,
    to_stage TEXT NOT NULL,
    required_role role_code NOT NULL,
    predicate_code TEXT NOT NULL,
    hard_block BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (authority, from_stage, to_stage, predicate_code),
    FOREIGN KEY (from_stage) REFERENCES workflow_stage(code),
    FOREIGN KEY (to_stage) REFERENCES workflow_stage(code)
);

CREATE TABLE workflow_instance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES project(id) ON DELETE CASCADE,
    authority authority_code NOT NULL,
    current_stage TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notification_at TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    lapsed_at TIMESTAMPTZ,
    FOREIGN KEY (current_stage) REFERENCES workflow_stage(code)
);

CREATE TABLE approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instance(id) ON DELETE CASCADE,
    from_stage TEXT NOT NULL,
    to_stage TEXT NOT NULL,
    actor_user_id UUID REFERENCES app_user(id),
    actor_role role_code NOT NULL,
    decision workflow_event_type NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE timeline_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instance(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE objection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL REFERENCES parcel(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES owner(id),
    filed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    hearing_at TIMESTAMPTZ,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'filed' CHECK (status IN ('filed', 'heard', 'allowed', 'rejected', 'withdrawn')),
    resolution TEXT
);

CREATE TABLE survey_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL REFERENCES parcel(id) ON DELETE CASCADE,
    surveyor_user_id UUID REFERENCES app_user(id),
    measured_area_hectares NUMERIC(14,6) CHECK (measured_area_hectares IS NULL OR measured_area_hectares > 0),
    gps_accuracy_meters NUMERIC(10,3) CHECK (gps_accuracy_meters IS NULL OR gps_accuracy_meters >= 0),
    captured_at TIMESTAMPTZ,
    acknowledgement BOOLEAN NOT NULL DEFAULT false,
    evidence_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE award (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    parcel_id UUID NOT NULL REFERENCES parcel(id) ON DELETE CASCADE,
    market_value_paise NUMERIC(20,0) NOT NULL CHECK (market_value_paise >= 0),
    solatium_paise NUMERIC(20,0) NOT NULL DEFAULT 0 CHECK (solatium_paise >= 0),
    total_paise NUMERIC(20,0) NOT NULL CHECK (total_paise >= 0),
    formula_version TEXT NOT NULL,
    signed_at TIMESTAMPTZ,
    UNIQUE (project_id, parcel_id)
);

CREATE TABLE affected_family (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    parcel_id UUID REFERENCES parcel(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    vulnerability_tags TEXT[] NOT NULL DEFAULT '{}',
    displaced BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE rr_entitlement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affected_family_id UUID NOT NULL REFERENCES affected_family(id) ON DELETE CASCADE,
    entitlement_type TEXT NOT NULL,
    amount_paise NUMERIC(20,0) CHECK (amount_paise IS NULL OR amount_paise >= 0),
    delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'in_progress', 'delivered')),
    target_date DATE
);

CREATE TABLE payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    award_id UUID NOT NULL REFERENCES award(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES owner(id),
    amount_paise NUMERIC(20,0) NOT NULL CHECK (amount_paise >= 0),
    status payment_status NOT NULL DEFAULT 'pending',
    idempotency_key TEXT NOT NULL UNIQUE,
    pfms_reference TEXT,
    utr TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);

CREATE TABLE possession (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL UNIQUE REFERENCES parcel(id) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('surrendered', 'forcible', 'disputed')),
    recorded_by UUID REFERENCES app_user(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    evidence_hash TEXT
);

CREATE TABLE mutation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL UNIQUE REFERENCES parcel(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed')),
    external_reference TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ
);

CREATE TABLE litigation_case (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    parcel_id UUID REFERENCES parcel(id) ON DELETE SET NULL,
    case_reference TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'stayed', 'vacated', 'closed')),
    stay_from TIMESTAMPTZ,
    stay_to TIMESTAMPTZ
);

CREATE TABLE document (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenant(id),
    project_id UUID REFERENCES project(id) ON DELETE CASCADE,
    parcel_id UUID REFERENCES parcel(id) ON DELETE CASCADE,
    kind document_kind NOT NULL,
    file_name TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    object_key TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    supersedes_id UUID REFERENCES document(id),
    signed_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (object_key, version)
);

CREATE TABLE clearance_gate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    clearance_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'not_required', 'verified')),
    reference_number TEXT,
    evidence_document_id UUID REFERENCES document(id),
    basis TEXT
);

CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    tenant_id UUID REFERENCES tenant(id),
    actor_user_id UUID REFERENCES app_user(id),
    actor_role role_code,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    previous_hash TEXT NOT NULL DEFAULT '',
    row_hash TEXT NOT NULL
);

CREATE TABLE outbox_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

CREATE TABLE alert (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenant(id),
    project_id UUID REFERENCES project(id) ON DELETE CASCADE,
    parcel_id UUID REFERENCES parcel(id) ON DELETE CASCADE,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    due_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE kpi_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenant(id),
    snapshot_date DATE NOT NULL,
    scope_level TEXT NOT NULL,
    scope_code TEXT,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (tenant_id, snapshot_date, scope_level, scope_code)
);


CREATE INDEX IF NOT EXISTS parcel_boundary_gix ON parcel USING GIST (boundary);
CREATE INDEX IF NOT EXISTS parcel_centroid_gix ON parcel USING GIST (centroid);
CREATE INDEX IF NOT EXISTS project_alignment_gix ON project USING GIST (alignment);
CREATE INDEX parcel_project_idx ON parcel (project_id, status);
CREATE INDEX audit_entity_idx ON audit_log (entity_type, entity_id, occurred_at DESC);
CREATE INDEX outbox_unpublished_idx ON outbox_event (occurred_at) WHERE published_at IS NULL;
CREATE INDEX alert_due_idx ON alert (due_at) WHERE acknowledged_at IS NULL;

CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$;
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

CREATE OR REPLACE FUNCTION app_tenant_matches(candidate UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('app.tenant_id', true), ''), '') = ''
        OR candidate::text = current_setting('app.tenant_id', true);
$$;

ALTER TABLE project ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE document ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_tenant_scope ON project USING (app_tenant_matches(tenant_id));
CREATE POLICY parcel_tenant_scope ON parcel USING (app_tenant_matches(tenant_id));
CREATE POLICY owner_tenant_scope ON owner USING (app_tenant_matches(tenant_id));
CREATE POLICY document_tenant_scope ON document USING (app_tenant_matches(tenant_id));
CREATE POLICY audit_tenant_scope ON audit_log USING (app_tenant_matches(tenant_id));

INSERT INTO app_role (code, label) VALUES
    ('admin', 'Administrator'),
    ('collector', 'District Collector'),
    ('revenue_officer', 'Revenue Officer'),
    ('land_owner', 'Land Owner')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_permission (code, label) VALUES
    ('users.manage', 'Manage users'), ('projects.create', 'Create projects'),
    ('projects.read', 'Read projects'), ('projects.update', 'Update projects'),
    ('projects.transition', 'Advance workflow'), ('parcels.create', 'Create parcels'),
    ('parcels.read', 'Read parcels'), ('parcels.update', 'Update parcels'),
    ('owners.read', 'Read owners'), ('audit.read', 'Read audit logs'),
    ('grievances.create', 'Create grievances')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permission (role_code, permission_code)
SELECT 'admin'::role_code, code FROM app_permission
ON CONFLICT DO NOTHING;
INSERT INTO role_permission (role_code, permission_code) VALUES
    ('collector', 'projects.create'), ('collector', 'projects.read'), ('collector', 'projects.update'), ('collector', 'projects.transition'), ('collector', 'parcels.create'), ('collector', 'parcels.read'), ('collector', 'parcels.update'), ('collector', 'owners.read'),
    ('revenue_officer', 'projects.read'), ('revenue_officer', 'parcels.read'), ('revenue_officer', 'parcels.update'), ('revenue_officer', 'owners.read'),
    ('land_owner', 'projects.read'), ('land_owner', 'parcels.read'), ('land_owner', 'owners.read'), ('land_owner', 'grievances.create')
ON CONFLICT DO NOTHING;

INSERT INTO regime (code, name, version) VALUES
    ('larr', 'RFCTLARR Act 2013', 'MVP-1'),
    ('national_highways', 'National Highways Act 1956', 'MVP-1')
ON CONFLICT (code) DO NOTHING;

INSERT INTO workflow_stage (code, authority, ordinal, label, deadline_days) VALUES
    ('project_created', 'larr', 0, 'Project Created', NULL),
    ('land_verification', 'larr', 1, 'Land Verification', NULL),
    ('notification', 'larr', 2, 'Notification', 60),
    ('objection_period', 'larr', 3, 'Objection Period', 60),
    ('award_generation', 'larr', 4, 'Award Generation', 365),
    ('compensation', 'larr', 5, 'Compensation', NULL),
    ('possession', 'larr', 6, 'Possession', NULL),
    ('completed', 'larr', 7, 'Completed', NULL),
    ('project_created_nh', 'national_highways', 0, 'Project Created', NULL),
    ('land_verification_nh', 'national_highways', 1, 'Land Verification', NULL),
    ('notification_nh', 'national_highways', 2, 'Notification', 21),
    ('objection_period_nh', 'national_highways', 3, 'Objection Period', 21),
    ('award_generation_nh', 'national_highways', 4, 'Award Generation', 365),
    ('compensation_nh', 'national_highways', 5, 'Compensation', NULL),
    ('possession_nh', 'national_highways', 6, 'Possession', NULL),
    ('completed_nh', 'national_highways', 7, 'Completed', NULL)
ON CONFLICT (code) DO NOTHING;
