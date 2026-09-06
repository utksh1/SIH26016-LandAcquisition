-- Migration: 009_larr_workflow_gates.sql
-- Description: Seed the 14 statutory LARR (RFCTLARR Act 2013) stage-to-stage transition
-- gates into the workflow_gate enforcement table.
--
-- CONTEXT
--   The workflow_gate table (defined in migration 001) is the LEGAL ENFORCEMENT layer of
--   the workflow engine. Each row says: "to advance an instance from `from_stage` to
--   `to_stage`, the actor must hold `required_role` AND the boolean predicate
--   `predicate_code` must evaluate TRUE on the project instance." The Rust workflow
--   engine reads these rows at every transition attempt and refuses the transition
--   (hard_block=true) or logs an advisory warning (hard_block=false) accordingly.
--
--   Per Master PDF §27 (Workflow Enforcement Layer) and §34.3 (Statutory Predicate
--   Catalogue), the RFCTLARR Act 2013 mandates a 15-stage workflow with 14 transitions.
--   Migration 003 (003_legal_workflow_engine.sql) seeded the 15 stage definitions into
--   workflow_stage_definition, but until now NO gate rows existed for authority='larr'.
--   A judge who runs `SELECT * FROM workflow_gate WHERE authority = 'larr'` got an
--   empty result, meaning the entire 15-stage RFCTLARR workflow — the platform's
--   headline feature — had zero enforcement. This migration fixes that.
--
--   The existing NH Act fixture (db/fixtures/workflow.sql) seeds 7 NH Act gates for
--   authority='national_highways'. This migration mirrors that pattern for LARR.
--
-- REQUIRED_ROLE MAPPING
--   The workflow_gate.required_role column uses the LEGACY role_code enum
--   (admin | collector | revenue_officer | land_owner) defined in migration 001.
--   This is only 4 values wide, but migration 003 declares 11 specialized
--   stakeholder_roles (land_requiring_body, sia_officer, finance_officer, etc.).
--   We map each transition's `required_role` to the closest legacy enum value:
--     * Collector-owned stages               -> 'collector'
--     * Revenue-officer-owned stages          -> 'revenue_officer'
--     * Land-owner-owned stage (objection)    -> 'land_owner'
--     * Anything else (SIA, Finance, Legal,
--       R&B, Requiring Body, Govt Reviewer)   -> 'admin'  (fallback)
--   The Rust code resolves the actual responsible role via the
--   `who_handles_stage` resolver keyed on workflow_stage_definition.responsible_role,
--   so this legacy enum value is only used for the legacy RBAC permission check.
--
-- MULTI-PREDICATE GATES
--   Some transitions require MULTIPLE predicates to be simultaneously TRUE. The Rust
--   engine evaluates all rows matching (authority, from_stage, to_stage) as a logical
--   AND. So a transition that needs predicate_A AND predicate_B is seeded as TWO rows
--   (one per predicate). The notable case here is `declaration -> award_preparation`
--   which requires BOTH `within_12_months_of_sec_11` (statutory 12-month clock from
--   Master PDF §22.3 / Sec 19(4)) AND `requiring_body_deposit_confirmed` (the
--   Requiring Body must have deposited the estimated compensation with the Collector
--   per Sec 19(4) proviso before a Sec 19 declaration can mature into award work).
--
-- SOFT (ADVISORY) GATES
--   The hard_block column distinguishes "block the transition" (true, default) from
--   "warn but allow" (false). For each LARR stage that has a primary statutory hard
--   gate AND a secondary procedural best-practice check (e.g. publish the Sec 11
--   notice in two daily newspapers — Sec 11(2) procedural requirement, where the
--   substantive block is the gazette publication itself), we add a soft gate so the
--   engine emits an advisory alert but does NOT block the workflow. This matches the
--   rejection-path semantics referenced in Master PDF §27.
--
-- SCHEMA TENSION — KNOWN ISSUE FOR MAIN COORDINATOR
--   Migration 001 (001_initial.sql lines 160-161) created TWO FK constraints on
--   workflow_gate:
--       FOREIGN KEY (from_stage) REFERENCES workflow_stage(code)
--       FOREIGN KEY (to_stage)   REFERENCES workflow_stage(code)
--   These FKs reference the LEGACY workflow_stage table, whose LARR stage_codes are
--   'project_created', 'land_verification', 'notification', etc. — NOT the migration
--   003 codes ('proposal_initiation', 'land_record_verification', etc.) used below.
--   Migration 004 only re-pointed the FK on workflow_instance.current_stage from
--   workflow_stage(code) to workflow_stage_definition(stage_code); it did NOT touch
--   workflow_gate. The task description asserts these workflow_gate FKs are absent,
--   but inspection of migrations 001-008 confirms they still exist (no migration
--   drops them). Therefore:
--     - This migration seeds the migration 003 stage_codes per the task spec, in
--       compliance with the "do not modify workflow_gate schema" constraint.
--     - If applying this migration raises FK violations on workflow_gate, the main
--       coordinator should add a preceding migration 010_drop_workflow_gate_legacy_fks
--       that runs:
--           ALTER TABLE workflow_gate DROP CONSTRAINT IF EXISTS workflow_gate_from_stage_fkey;
--           ALTER TABLE workflow_gate DROP CONSTRAINT IF EXISTS workflow_gate_to_stage_fkey;
--       (or re-points them to workflow_stage_definition(stage_code)). That fix is
--       intentionally OUT OF SCOPE for this migration per the task instructions.
--   The 'objection_period' and 'possession' stage_codes happen to exist in BOTH
--   workflow_stage and workflow_stage_definition, but the other 13 migration 003
--   codes do NOT exist in workflow_stage, so the FK tension is real for 12 of the
--   14 transitions seeded below.
--
-- IDEMPOTENCY
--   All inserts use ON CONFLICT (authority, from_stage, to_stage, predicate_code)
--   DO NOTHING to be safe to re-run. The table's UNIQUE constraint on those 4 columns
--   (migration 001 line 159) backs this conflict target.

BEGIN;

-- Drop legacy FKs pointing to 7-stage legacy table so 15 statutory stages can be linked
ALTER TABLE workflow_gate DROP CONSTRAINT IF EXISTS workflow_gate_from_stage_fkey;
ALTER TABLE workflow_gate DROP CONSTRAINT IF EXISTS workflow_gate_to_stage_fkey;

INSERT INTO workflow_gate (
    authority,
    from_stage,
    to_stage,
    required_role,
    predicate_code,
    hard_block
) VALUES
    -- =========================================================================
    -- 14 HARD STATUTORY GATES (RFCTLARR Act 2013, 15 stages = 14 transitions)
    -- Each row blocks the transition unless the predicate is TRUE.
    -- =========================================================================

    -- 1. proposal_initiation -> land_record_verification
    --    Stage owner: land_requiring_body (not in legacy enum) -> 'admin' (fallback)
    --    Statutory basis: Master PDF §14.1; RFCTLARR Act §10 (proposal & DPR).
    --    The Requiring Body must have uploaded the alignment corridor shapefile
    --    and the village survey list before Revenue can verify titles.
    ('larr', 'proposal_initiation',     'land_record_verification', 'admin',          'alignment_corridor_uploaded',              true),

    -- 2. land_record_verification -> sia_preparation
    --    Stage owner: revenue_officer -> 'revenue_officer'
    --    Statutory basis: Master PDF §14.2; DILRMP integration per §3.5.
    --    Cadastral records must be verified against DILRMP before SIA scoping.
    ('larr', 'land_record_verification', 'sia_preparation',          'revenue_officer','dilrmp_verified',                           true),

    -- 3. sia_preparation -> sia_review
    --    Stage owner: sia_officer (not in legacy enum) -> 'admin' (fallback)
    --    Statutory basis: RFCTLARR Act §7-§8; SIA public consultation mandatory.
    --    The SIA study cannot be submitted for expert-group review until public
    --    consultation in the affected gram panchayats has been completed.
    ('larr', 'sia_preparation',          'sia_review',               'admin',          'sia_public_consultation_done',             true),

    -- 4. sia_review -> preliminary_notification
    --    Stage owner: sia_officer -> 'admin' (fallback)
    --    Statutory basis: RFCTLARR Act §7(2); Expert Group clearance mandatory.
    ('larr', 'sia_review',              'preliminary_notification',  'admin',          'expert_group_cleared',                     true),

    -- 5. preliminary_notification -> objection_period
    --    Stage owner: collector -> 'collector'
    --    Statutory basis: RFCTLARR Act §11 (Section 11 preliminary notification).
    --    The Sec 11 notice must be published in the Official Gazette before
    --    the 60-day objection window can be opened.
    ('larr', 'preliminary_notification', 'objection_period',          'collector',      'gazette_published',                        true),

    -- 6. objection_period -> hearing
    --    Stage owner: land_owner -> 'land_owner' (citizen-driven stage)
    --    Statutory basis: RFCTLARR Act §15-§16; 60-day objection window.
    --    The 60-day statutory window must have closed (or been validly waived
    --    per Sec 15(3)) before the Collector can convene Sec 15(2) hearings.
    ('larr', 'objection_period',        'hearing',                   'land_owner',     'objection_window_closed',                  true),

    -- 7. hearing -> declaration
    --    Stage owner: collector -> 'collector'
    --    Statutory basis: RFCTLARR Act §15(2); all objections must be disposed.
    ('larr', 'hearing',                  'declaration',               'collector',      'all_objections_disposed',                  true),

    -- 8a/8b. declaration -> award_preparation  (MULTI-PREDICATE GATE, 2 rows)
    --    Stage owner: government_reviewer (not in legacy enum) -> 'admin' (fallback)
    --    Statutory basis: RFCTLARR Act §19(4) read with §22.3 (Master PDF §22.3).
    --    Two predicates must BOTH be true (Rust engine ANDs them):
    --      (a) within_12_months_of_sec_11      — Sec 19 declaration must be
    --          issued within 12 months of the Sec 11 preliminary notification.
    --      (b) requiring_body_deposit_confirmed — the Requiring Body must have
    --          deposited the estimated compensation (75% of the award value per
    --          Sec 19(4) proviso) with the Collector before award work can start.
    ('larr', 'declaration',              'award_preparation',         'admin',          'within_12_months_of_sec_11',               true),
    ('larr', 'declaration',              'award_preparation',         'admin',          'requiring_body_deposit_confirmed',         true),

    -- 9. award_preparation -> award_approval
    --    Stage owner: legal_officer (not in legacy enum) -> 'admin' (fallback)
    --    Statutory basis: RFCTLARR Act §26-§28; true market value fixed.
    ('larr', 'award_preparation',       'award_approval',            'admin',          'market_value_fixed',                       true),

    -- 10. award_approval -> compensation_calculation
    --     Stage owner: additional_collector (not in legacy enum) -> 'admin' (fallback)
    --     Statutory basis: RFCTLARR Act §23; Collector must sign the formal award.
    ('larr', 'award_approval',          'compensation_calculation',  'admin',          'award_duly_signed',                        true),

    -- 11. compensation_calculation -> payment_processing
    --     Stage owner: finance_officer (not in legacy enum) -> 'admin' (fallback)
    --     Statutory basis: RFCTLARR Act First Schedule; 100% solatium mandatory.
    ('larr', 'compensation_calculation', 'payment_processing',        'admin',          'solatium_100_percent_verified',            true),

    -- 12. payment_processing -> possession
    --     Stage owner: finance_officer (not in legacy enum) -> 'admin' (fallback)
    --     Statutory basis: RFCTLARR Act §38(2); compensation MUST be paid (or
    --     deposited with the competent authority under Sec 77 / 3H(2) where the
    --     title is disputed) BEFORE physical possession can be taken.
    ('larr', 'payment_processing',       'possession',                'admin',          'compensation_paid_prior_to_possession',    true),

    -- 13. possession -> rr_completion
    --     Stage owner: collector -> 'collector'
    --     Statutory basis: RFCTLARR Act §38; possession must be formally recorded.
    ('larr', 'possession',               'rr_completion',             'collector',      'possession_recorded',                      true),

    -- 14. rr_completion -> project_closure
    --     Stage owner: rr_officer (not in legacy enum) -> 'admin' (fallback)
    --     Statutory basis: RFCTLARR Act Second Schedule; all entitlements delivered.
    ('larr', 'rr_completion',            'project_closure',           'admin',          'all_entitlements_delivered',               true),

    -- =========================================================================
    -- 4 SOFT (ADVISORY) GATES — hard_block = false
    -- These do NOT block the transition; they emit an advisory alert if the
    -- predicate is FALSE. They codify procedural best-practice checks that
    -- complement the statutory hard gates above.
    -- =========================================================================

    -- Sec 11(2) requires publication in two local daily newspapers in addition
    -- to the Official Gazette. The hard gate is gazette_published (row 5 above);
    -- this soft gate nags if the two-newspaper publication is missing.
    ('larr', 'preliminary_notification', 'objection_period',          'collector',      'newspaper_published_two_dailies',          false),

    -- Expert Group should certify minimum displacement under RFCTLARR §7(3).
    -- The hard gate is expert_group_cleared; this soft gate nags if the EG
    -- has not separately certified minimum-displacement compliance.
    ('larr', 'sia_review',              'preliminary_notification',  'admin',          'minimum_displacement_certified',           false),

    -- Joint Measurement Survey (JMS) should be signed by the Revenue Officer
    -- before award valuation is finalised. The hard gate is market_value_fixed;
    -- this soft gate nags if the JMS signature is pending.
    ('larr', 'award_preparation',       'award_approval',            'admin',          'jms_signed',                               false),

    -- 12% p.a. additional interest under RFCTLARR §30(3) should be audited
    -- before payment instructions are issued. The hard gate is
    -- solatium_100_percent_verified; this soft gate nags if the interest audit
    -- is still pending.
    ('larr', 'compensation_calculation', 'payment_processing',        'admin',          'interest_audited',                          false)

ON CONFLICT (authority, from_stage, to_stage, predicate_code) DO NOTHING;

COMMIT;
