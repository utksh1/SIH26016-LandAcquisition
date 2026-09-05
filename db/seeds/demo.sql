-- Demo data for local development. Run after 001_initial.sql.
BEGIN;

INSERT INTO tenant (id, name, code)
VALUES ('00000000-0000-0000-0000-000000000001', 'SIH26016 Demo Tenant', 'SIH_DEMO')
ON CONFLICT (id) DO NOTHING;

INSERT INTO app_user (id, tenant_id, username, display_name, email, password_hash)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'admin01', 'Aarav Sharma', 'admin@example.gov.in', NULL),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'collector01', 'Ananya Sen', 'collector@example.gov.in', NULL),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'revenue01', 'Rakesh Kumar', 'revenue@example.gov.in', NULL),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'owner01', 'Meera Devi', 'owner@example.com', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_role_assignment (user_id, role_code, scope_level, scope_code)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'admin', 'national', NULL),
  ('00000000-0000-0000-0000-000000000011', 'collector', 'district', 'BLR'),
  ('00000000-0000-0000-0000-000000000012', 'revenue_officer', 'state', 'KA'),
  ('00000000-0000-0000-0000-000000000013', 'land_owner', 'parcel', '00000000-0000-0000-0000-000000000101')
ON CONFLICT DO NOTHING;

INSERT INTO project (id, tenant_id, name, authority, requiring_body, state_code, district_code, status, budget_paise)
VALUES ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', 'Delhi-Mumbai Highway Expansion', 'national_highways', 'NHAI', 'KA', 'BLR', 'land_verification', 312000000000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO owner (id, tenant_id, name, contact_reference, address)
VALUES ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000001', 'Meera Devi', 'masked:owner-01', 'Bharatpur, Karnataka')
ON CONFLICT (id) DO NOTHING;

INSERT INTO parcel (id, tenant_id, project_id, survey_number, ulpin, area_hectares, status, district_code, boundary, centroid)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000100',
  '45/2', '29200000000001', 2.5, 'under_process', 'BLR',
  ST_GeomFromText('POLYGON((77.58 12.96,77.59 12.96,77.59 12.97,77.58 12.97,77.58 12.96))', 4326),
  ST_SetSRID(ST_Point(77.585, 12.965), 4326)
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parcel_owner (parcel_id, owner_id, interest_fraction)
VALUES ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000200', 1)
ON CONFLICT DO NOTHING;

INSERT INTO workflow_instance (project_id, authority, current_stage, deadline_at)
VALUES ('00000000-0000-0000-0000-000000000100', 'national_highways', 'land_verification_nh', now() + interval '21 days')
ON CONFLICT (project_id) DO NOTHING;

COMMIT;
