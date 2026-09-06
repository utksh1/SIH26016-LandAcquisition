-- Migration: 012_rfctlarr_authoritative_workflow.sql
-- Description: Align RFCTLARR Act 2013 stage definitions and transition gates with Master PDF §8.2, §22, and §27.1.
-- Authorizes direct statutory transition from Award Approval (Sec 23/30) to Possession (Sec 38)
-- with compensation payment enforcement, eliminating artificial sequential gates.

BEGIN;

-- Add description column to workflow_gate if missing
ALTER TABLE workflow_gate ADD COLUMN IF NOT EXISTS description TEXT;

-- 1. Update workflow_stage_definition with authoritative statutory section titles,
-- authorities, and direct statutory allowed_transitions.

UPDATE workflow_stage_definition
SET 
    stage_name = 'Proposal Initiation & Clearances (Sec 18)',
    approval_authority = 'Central / State Sanctioning Authority',
    allowed_transitions = '["land_record_verification", "sia_preparation"]'::jsonb,
    audit_requirements = 'Project proposal logged with corridor geometry hash, budget sanction reference, and pre-condition clearance gates (Master PDF §15/§18).'
WHERE stage_code = 'proposal_initiation';

UPDATE workflow_stage_definition
SET 
    stage_name = 'Land Record Verification (DILRMP/RoR)',
    approval_authority = 'Sub-Divisional Officer (SDM) / Tehsildar',
    allowed_transitions = '["sia_preparation", "preliminary_notification"]'::jsonb,
    audit_requirements = 'Cadastral revenue records verified against State DILRMP with ULPIN, Jamabandi RoR, and encumbrance certificate.'
WHERE stage_code = 'land_record_verification';

UPDATE workflow_stage_definition
SET 
    stage_name = 'SIA Study & Public Consultation (Sec 4-6)',
    approval_authority = 'District Collector / SIA Directorate',
    allowed_transitions = '["sia_review"]'::jsonb,
    audit_requirements = 'SIA study conducted by empanelled agency; baseline census completed; public hearing conducted in affected panchayats with recorded minutes.'
WHERE stage_code = 'sia_preparation';

UPDATE workflow_stage_definition
SET 
    stage_name = 'SIA Appraisal & Govt Approval (Sec 7-9)',
    approval_authority = 'Independent Multidisciplinary Expert Group & Appropriate Government',
    allowed_transitions = '["preliminary_notification"]'::jsonb,
    audit_requirements = 'Independent Expert Group appraisal evaluated; Appropriate Government records decision on public purpose and minimum land requirement (Sec 8(2)). 12-month validity under Sec 14.'
WHERE stage_code = 'sia_review';

UPDATE workflow_stage_definition
SET 
    stage_name = 'Preliminary Notification (Sec 11)',
    approval_authority = 'District Collector / Official Gazette',
    allowed_transitions = '["objection_period"]'::jsonb,
    audit_requirements = 'Section 11 Gazette Extraordinary published; 2 local newspaper cuttings on file (including regional language); Gram Sabha notices posted; land transaction freeze flag active.'
WHERE stage_code = 'preliminary_notification';

UPDATE workflow_stage_definition
SET 
    stage_name = 'Objections Filing Window (Sec 15)',
    approval_authority = 'District Collector & CALA',
    allowed_transitions = '["hearing"]'::jsonb,
    audit_requirements = 'Statutory 60-day objection window opened; citizen claims and compensation objections recorded with immutable ticket IDs.'
WHERE stage_code = 'objection_period';

UPDATE workflow_stage_definition
SET 
    stage_name = 'Hearing & Objection Disposal (Sec 15(2))',
    approval_authority = 'District Collector / Competent Authority (CALA)',
    allowed_transitions = '["declaration"]'::jsonb,
    audit_requirements = 'Section 15(2) personal hearings conducted; written disposal orders issued to objectors; Collector recommendation submitted to Government.'
WHERE stage_code = 'hearing';

UPDATE workflow_stage_definition
SET 
    stage_name = 'Declaration of Acquisition (Sec 19)',
    approval_authority = 'Appropriate Government (Cabinet Secretariat / State Secretary)',
    allowed_transitions = '["award_preparation"]'::jsonb,
    audit_requirements = 'Section 19 Declaration issued within statutory 12-month limit of Sec 11; R&R Scheme under Sec 16 approved and summary published; requiring body cost deposit confirmed.'
WHERE stage_code = 'declaration';

UPDATE workflow_stage_definition
SET 
    stage_name = 'Award Enquiry & Asset Valuation (Sec 21-29)',
    approval_authority = 'Competent Authority Land Acquisition (CALA)',
    allowed_transitions = '["award_approval"]'::jsonb,
    audit_requirements = 'Section 21 notice to interested persons served; Joint Measurement Survey (JMS) signed; market value fixed per Sec 26; attachment valuations (structures, trees, crops) completed per Sec 29.'
WHERE stage_code = 'award_preparation';

UPDATE workflow_stage_definition
SET 
    stage_name = 'Compensation Award Approval (Sec 23/30)',
    approval_authority = 'District Collector / Competent Authority (CALA)',
    -- Allow direct transition to possession (when compensation paid) or parallel R&R/financial stages
    allowed_transitions = '["possession", "payment_processing", "compensation_calculation", "rr_completion"]'::jsonb,
    audit_requirements = 'Formal Section 23/30 compensation award approved under Collector DSC signature; 100% First Schedule Solatium and Sec 30(3) 12% p.a. interest verified with apportionment statement.'
WHERE stage_code = 'award_approval';

UPDATE workflow_stage_definition
SET 
    stage_name = 'Compensation Calculation & Interest (Sec 26-30)',
    approval_authority = 'Controller of Accounts / Finance Division',
    allowed_transitions = '["payment_processing", "possession"]'::jsonb,
    audit_requirements = 'First Schedule multiplier applied (1.00-2.00 rural, 1.00 urban); 100% Solatium computed; 12% p.a. additional interest accrued under Sec 30(3).'
WHERE stage_code = 'compensation_calculation';

UPDATE workflow_stage_definition
SET 
    stage_name = 'PFMS Disbursement & Escrow Deposit (Sec 38/77)',
    approval_authority = 'Finance Division / PFMS Treasury Officer',
    allowed_transitions = '["possession"]'::jsonb,
    audit_requirements = 'Direct Benefit Transfer disbursed through PFMS with live UTR numbers; disputed compensation deposited with Authority under Section 77.'
WHERE stage_code = 'payment_processing';

UPDATE workflow_stage_definition
SET 
    stage_name = 'Physical Possession (Sec 38)',
    approval_authority = 'District Collector / Requiring Body',
    allowed_transitions = '["project_closure", "rr_completion"]'::jsonb,
    audit_requirements = 'Physical possession taken under Section 38 ONLY AFTER full compensation and monetary R&R are paid or deposited; Panchnama recorded; handover certificate executed.'
WHERE stage_code = 'possession';

UPDATE workflow_stage_definition
SET 
    stage_name = 'R&R Entitlements & Site Monitoring (Sec 31-42)',
    approval_authority = 'Administrator R&R / National Monitoring Committee',
    allowed_transitions = '["project_closure"]'::jsonb,
    audit_requirements = 'Schedule II per-family entitlements verified; Third Schedule resettlement site infrastructure (roads, water, electricity, school) progress monitored to completion.'
WHERE stage_code = 'rr_completion';

UPDATE workflow_stage_definition
SET 
    stage_name = 'Revenue Mutation & Project Closure',
    approval_authority = 'State Revenue Department & Central/State Ministry',
    allowed_transitions = '[]'::jsonb,
    is_terminal = true,
    audit_requirements = 'Land title mutated in favor of Government in Record of Rights (RoR); final CAG financial reconciliation certificate archived; project closed.'
WHERE stage_code = 'project_closure';

-- 2. Seed statutory gates for direct transitions in workflow_gate:
-- Award Approval -> Possession (gated on compensation paid)
INSERT INTO workflow_gate (
    authority, from_stage, to_stage, required_role, predicate_code, hard_block, description
) VALUES
    ('larr', 'award_approval', 'possession', 'collector', 'compensation_paid_or_tendered', true,
     'Section 38 hard gate: Possession requires full compensation to be paid or tendered to all entitled persons, or deposited with the Authority under Section 77.'),
    ('larr', 'award_approval', 'possession', 'collector', 'no_subsisting_stay', true,
     'Statutory court stay check: Possession cannot be taken while a court stay order is active on the affected parcels.'),
    ('larr', 'possession', 'project_closure', 'collector', 'title_mutated', false,
     'Post-possession revenue mutation: Jamabandi RoR must be updated to record Government vesting within 30 days of possession.')
ON CONFLICT (authority, from_stage, to_stage, predicate_code) DO UPDATE SET
    required_role = EXCLUDED.required_role,
    hard_block = EXCLUDED.hard_block,
    description = EXCLUDED.description;

COMMIT;
