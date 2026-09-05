-- Demo data for local development. Run after migrations 001 through 005.
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

INSERT INTO workflow_instance (id, project_id, authority, current_stage, deadline_at)
VALUES ('b02b72e7-cef0-47b7-916e-0a460cbf0eef', '00000000-0000-0000-0000-000000000100', 'national_highways', 'land_record_verification', now() + interval '30 days')
ON CONFLICT (project_id) DO UPDATE SET current_stage = EXCLUDED.current_stage;

INSERT INTO approval_history (id, workflow_instance_id, from_stage, to_stage, actor_user_id, actor_role, decision, reason, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000701',
    'b02b72e7-cef0-47b7-916e-0a460cbf0eef',
    'proposal_initiation',
    'land_record_verification',
    '00000000-0000-0000-0000-000000000010',
    'land_requiring_body',
    'approved',
    'Corridor alignment DPR verified and sanctioned by NHAI Project Director.',
    now() - interval '1 day'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO affected_family (id, project_id, parcel_id, name, vulnerability_tags, displaced)
VALUES
    ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000101', 'Meera Devi Family', ARRAY['bpl', 'women_headed'], true),
    ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000101', 'Ramesh Yadav Family', ARRAY['small_farmer'], false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rr_entitlement (id, affected_family_id, entitlement_type, amount_paise, delivery_status, target_date)
VALUES
    ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000301', 'Housing Grant (Schedule II)', 150000000, 'in_progress', CURRENT_DATE + 45),
    ('00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000301', 'Subsistence Allowance (Schedule II)', 36000000, 'pending', CURRENT_DATE + 60),
    ('00000000-0000-0000-0000-000000000313', '00000000-0000-0000-0000-000000000302', 'Resettlement Allowance', 50000000, 'pending', CURRENT_DATE + 90)
ON CONFLICT (id) DO NOTHING;

INSERT INTO objection (id, project_id, parcel_id, survey_number, owner_name, objection_type, description, text, status, resolution, filed_at)
VALUES (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000100',
    '00000000-0000-0000-0000-000000000101',
    '45/2',
    'Meera Devi',
    'boundary_dispute',
    'Disputed boundary overlap with canal irrigation reserve on northern corner of survey 45/2',
    'Disputed boundary overlap with canal irrigation reserve on northern corner of survey 45/2',
    'filed',
    NULL,
    now() - interval '2 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document (id, tenant_id, project_id, parcel_id, kind, file_name, content_hash, object_key, version, signed_by, created_at)
VALUES
    (
        '00000000-0000-0000-0000-000000000501',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        '00000000-0000-0000-0000-000000000101',
        'cadastral_map',
        'cadastral_map_45_2_signed.pdf',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'docs/00000000-0000-0000-0000-000000000100/cadastral_map_45_2_signed.pdf',
        1,
        'Neha Singh (GIS Officer)',
        now() - interval '3 days'
    ),
    (
        '00000000-0000-0000-0000-000000000502',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        '00000000-0000-0000-0000-000000000101',
        'dpr_feasibility_report',
        'dpr_feasibility_report.pdf',
        '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
        'docs/00000000-0000-0000-0000-000000000100/dpr_feasibility_report.pdf',
        1,
        'Praveen Singhal (Chief Project Officer)',
        now() - interval '4 days'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO alert (id, tenant_id, project_id, parcel_id, severity, alert_type, message, due_at)
VALUES
    (
        '00000000-0000-0000-0000-000000000601',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        '00000000-0000-0000-0000-000000000101',
        'high',
        'GATE_04',
        'Compensation award pack needs approval: 12 of 18 village-level packets are ready for CALA sign-off.',
        now() + interval '5 days'
    ),
    (
        '00000000-0000-0000-0000-000000000602',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        '00000000-0000-0000-0000-000000000101',
        'medium',
        'PFMS',
        '₹46.2 Cr released to district escrow: Settlement batch PF-2026-091 cleared 06 Sep 2026.',
        now() + interval '10 days'
    ),
    (
        '00000000-0000-0000-0000-000000000603',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000100',
        '00000000-0000-0000-0000-000000000101',
        'low',
        'R&R',
        'Household verification window closes soon: Kushinagar submissions close in 9 days.',
        now() + interval '9 days'
    )
ON CONFLICT (id) DO NOTHING;

COMMIT;
