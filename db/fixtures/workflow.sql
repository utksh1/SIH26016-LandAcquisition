-- Minimal workflow fixture for local PostGIS development.
-- Run after db/migrations/001_initial.sql and db/seeds/demo.sql.
BEGIN;

INSERT INTO workflow_gate (
    authority,
    from_stage,
    to_stage,
    required_role,
    predicate_code,
    hard_block
)
VALUES
    ('national_highways', 'project_created_nh', 'land_verification_nh', 'collector', 'project_has_requiring_body', true),
    ('national_highways', 'land_verification_nh', 'notification_nh', 'collector', 'all_parcels_verified', true),
    ('national_highways', 'notification_nh', 'objection_period_nh', 'collector', 'notification_published', true),
    ('national_highways', 'objection_period_nh', 'award_generation_nh', 'collector', 'objections_resolved_or_recorded', true),
    ('national_highways', 'award_generation_nh', 'compensation_nh', 'collector', 'awards_signed', true),
    ('national_highways', 'compensation_nh', 'possession_nh', 'collector', 'payments_instructed', true),
    ('national_highways', 'possession_nh', 'completed_nh', 'collector', 'possession_recorded', true)
ON CONFLICT (authority, from_stage, to_stage, predicate_code) DO NOTHING;

INSERT INTO timeline_event (workflow_instance_id, event_type, occurred_at, metadata)
SELECT wi.id, 'fixture_loaded', now(), jsonb_build_object('source', 'db/fixtures/workflow.sql')
FROM workflow_instance wi
JOIN project p ON p.id = wi.project_id
WHERE p.name = 'Delhi-Mumbai Highway Expansion'
  AND NOT EXISTS (
      SELECT 1
      FROM timeline_event te
      WHERE te.workflow_instance_id = wi.id
        AND te.event_type = 'fixture_loaded'
  );

COMMIT;
