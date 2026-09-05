-- Migration: 003_legal_workflow_engine.sql
-- Description: Legal Workflow Orchestration Engine (15 Stages, 10 Departments, 11 Roles) under RFCTLARR Act 2013

-- 1. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS departments (
    code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mandate TEXT NOT NULL,
    parent_authority VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. STAKEHOLDER ROLES TABLE
CREATE TABLE IF NOT EXISTS stakeholder_roles (
    code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    department_code VARCHAR(64) NOT NULL REFERENCES departments(code) ON DELETE CASCADE,
    tier SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 4),
    default_jurisdiction VARCHAR(64) NOT NULL DEFAULT 'district',
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. WORKFLOW STAGE DEFINITIONS TABLE (15 Statutory Legal Stages)
CREATE TABLE IF NOT EXISTS workflow_stage_definition (
    stage_code VARCHAR(64) PRIMARY KEY,
    regime_code VARCHAR(32) NOT NULL DEFAULT 'rfctlarr_2013',
    ordinal INT NOT NULL CHECK (ordinal >= 1),
    stage_name VARCHAR(255) NOT NULL,
    department_code VARCHAR(64) NOT NULL REFERENCES departments(code),
    responsible_role VARCHAR(64) NOT NULL REFERENCES stakeholder_roles(code),
    approval_authority VARCHAR(255) NOT NULL,
    timeline_days INT NOT NULL CHECK (timeline_days > 0),
    required_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    allowed_transitions JSONB NOT NULL DEFAULT '[]'::jsonb,
    audit_requirements TEXT NOT NULL,
    gate_predicates JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_terminal BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (regime_code, ordinal)
);

-- SEED DEPARTMENTS (10 Statutory Departments)
INSERT INTO departments (code, name, mandate, parent_authority) VALUES
    ('requiring_body', 'Land Requiring Body', 'Requisitions land, provides DPR corridor alignment, funds acquisition and construction', 'NHAI / Railways / MoRTH'),
    ('revenue_dept', 'State Revenue Department', 'Cadastral land verification, Record of Rights (RoR) mutation, Jamabandi records', 'State Government'),
    ('survey_dept', 'Survey & Geo-informatics Wing', 'Cadastral boundary demarcation, GIS polygon mapping, DGPS ground-truthing', 'Directorate of Land Records'),
    ('social_impact_dept', 'Social Impact Assessment Unit', 'Conducts statutory SIA study, census of affected families, SIMP formulation', 'State SIA Directorate'),
    ('collectorate_dept', 'District Collectorate / CALA', 'Statutory competent authority, issues Sec 11/19 notices, conducts hearings, passes awards', 'District Administration'),
    ('legal_dept', 'Legal & Litigation Cell', 'Scrutinizes claims, manages court stays, resolves land ownership title disputes', 'State Law Department'),
    ('finance_dept', 'Finance & PFMS Division', 'Determines compensation awards, applies 100% Solatium & interest, executes PFMS DBT', 'Ministry of Finance'),
    ('rr_dept', 'Resettlement & Rehabilitation Directorate', 'Implements Schedule II entitlements, delivers housing grants, establishes model colony', 'R&R Commissionerate'),
    ('government_oversight', 'Appropriate Government / Oversight', 'Issues Section 19 declarations, monitors national corridors, configures regimes', 'Cabinet Secretariat / DoLR'),
    ('citizen_desk', 'Public Citizen Transparency Desk', 'Public portal for survey lookups, gazette notification downloads, Section 15 objections', 'Public Transparency Cell')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    mandate = EXCLUDED.mandate;

-- SEED STAKEHOLDER ROLES (11 Specialized Roles)
INSERT INTO stakeholder_roles (code, name, department_code, tier, default_jurisdiction, description) VALUES
    ('land_requiring_body', 'Land Requiring Body', 'requiring_body', 1, 'national', 'Chief Project Officer initiating corridor proposal and DPR upload'),
    ('revenue_officer', 'Revenue Officer', 'revenue_dept', 1, 'field', 'Tehsildar & Sub-Registrar verifying title, Khatiyan, and DILRMP sync'),
    ('gis_officer', 'GIS Officer', 'survey_dept', 1, 'district', 'Geo-informatics specialist verifying cadastral polygons and DGPS coordinates'),
    ('sia_officer', 'SIA Officer', 'social_impact_dept', 2, 'district', 'Social impact specialist conducting public consultations and SIMP report'),
    ('collector', 'District Collector / CALA', 'collectorate_dept', 1, 'district', 'Statutory controller issuing Sec 11/3A notices, conducting hearings, passing awards'),
    ('additional_collector', 'Additional Collector', 'collectorate_dept', 1, 'district', 'Assisting competent authority for valuation scrutiny and award certification'),
    ('legal_officer', 'Legal Officer', 'legal_dept', 2, 'district', 'Advises CALA on title disputes, reference under Sec 64, and court stays'),
    ('finance_officer', 'Finance Officer', 'finance_dept', 2, 'district', 'Accounts controller managing 100% Solatium, interest accrual, and PFMS DBT'),
    ('rr_officer', 'Rehabilitation Officer', 'rr_dept', 2, 'district', 'R&R Administrator managing affected families census and Schedule II grants'),
    ('government_reviewer', 'Government Reviewer', 'government_oversight', 3, 'national', 'Joint Secretary / Principal Secretary issuing Sec 19 declarations and monitoring policy'),
    ('land_owner', 'Land Owner / Citizen', 'citizen_desk', 4, 'public', 'Affected titleholder / citizen searching surveys, inspecting notices, and filing objections')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- SEED 15 STATUTORY LEGAL STAGES (RFCTLARR Act 2013)
INSERT INTO workflow_stage_definition (
    stage_code, regime_code, ordinal, stage_name, department_code, responsible_role,
    approval_authority, timeline_days, required_documents, allowed_transitions, audit_requirements, gate_predicates
) VALUES
    (
        'proposal_initiation', 'rfctlarr_2013', 1, 'Proposal Initiation',
        'requiring_body', 'land_requiring_body', 'Central/State Sanctioning Authority', 30,
        '["dpr_feasibility_report", "alignment_shapefile", "village_survey_list", "budget_sanction"]'::jsonb,
        '["land_record_verification"]'::jsonb,
        'Project proposal logged with alignment geometry hash and budget sanction reference.',
        '["has_alignment_corridor", "has_village_list"]'::jsonb
    ),
    (
        'land_record_verification', 'rfctlarr_2013', 2, 'Land Record Verification',
        'revenue_dept', 'revenue_officer', 'Sub-Divisional Officer (SDM)', 30,
        '["cadastral_map", "jamabandi_ror_extract", "dilrmp_sync_record"]'::jsonb,
        '["sia_preparation", "proposal_initiation"]'::jsonb,
        'Cadastral land records verified against State DILRMP with ULPIN and mutation status.',
        '["dilrmp_verified", "all_parcels_mapped"]'::jsonb
    ),
    (
        'sia_preparation', 'rfctlarr_2013', 3, 'SIA Preparation',
        'social_impact_dept', 'sia_officer', 'District Collector', 60,
        '["sia_terms_of_reference", "public_consultation_notice", "census_agency_moa"]'::jsonb,
        '["sia_review"]'::jsonb,
        'SIA public notice published in affected gram panchayats; baseline census initiated.',
        '["consultation_notice_published"]'::jsonb
    ),
    (
        'sia_review', 'rfctlarr_2013', 4, 'SIA Review',
        'social_impact_dept', 'sia_officer', 'Independent Expert Group / State Govt', 60,
        '["sia_study_report", "social_impact_management_plan", "expert_group_recommendation"]'::jsonb,
        '["preliminary_notification", "sia_preparation"]'::jsonb,
        'Independent Expert Group recommendations evaluated and approved by Appropriate Government.',
        '["expert_group_cleared", "minimum_displacement_certified"]'::jsonb
    ),
    (
        'preliminary_notification', 'rfctlarr_2013', 5, 'Preliminary Notification (Sec 11)',
        'collectorate_dept', 'collector', 'District Collector / Official Gazette', 30,
        '["section_11_notification_pdf", "local_newspaper_cuttings", "gram_sabha_resolution"]'::jsonb,
        '["objection_period"]'::jsonb,
        'Section 11 Gazette Extraordinary published; land transaction freeze flag applied.',
        '["gazette_published", "newspaper_published_two_dailies"]'::jsonb
    ),
    (
        'objection_period', 'rfctlarr_2013', 6, 'Objection Period (Sec 15)',
        'citizen_desk', 'land_owner', 'District Collector & CALA', 60,
        '["section_15_objection_petitions", "ownership_proof_documents"]'::jsonb,
        '["hearing"]'::jsonb,
        'Statutory 60-day objection window opened; citizen claims recorded with ticket IDs.',
        '["objection_window_elapsed_or_waived"]'::jsonb
    ),
    (
        'hearing', 'rfctlarr_2013', 7, 'Hearing & Disposal',
        'collectorate_dept', 'collector', 'District Collector', 30,
        '["section_15_2_hearing_minutes", "collector_disposal_order"]'::jsonb,
        '["declaration", "objection_period"]'::jsonb,
        'Section 15(2) personal hearings conducted; written disposal orders issued to objectors.',
        '["all_objections_disposed"]'::jsonb
    ),
    (
        'declaration', 'rfctlarr_2013', 8, 'Declaration (Sec 19)',
        'government_oversight', 'government_reviewer', 'Appropriate Government', 30,
        '["section_19_declaration_order", "approved_rr_scheme_summary", "fund_deposit_receipt"]'::jsonb,
        '["award_preparation"]'::jsonb,
        'Section 19 Declaration issued within statutory 12-month limit; R&R scheme summary gazetted.',
        '["within_12_months_of_sec_11", "requiring_body_deposit_confirmed"]'::jsonb
    ),
    (
        'award_preparation', 'rfctlarr_2013', 9, 'Award Preparation (Sec 23)',
        'collectorate_dept', 'legal_officer', 'Collector & CALA', 60,
        '["joint_measurement_survey_sheet", "asset_tree_structure_valuation", "circle_rate_schedule"]'::jsonb,
        '["award_approval"]'::jsonb,
        'True market value determined under Sec 26; attachment valuations completed per Sec 29.',
        '["market_value_fixed", "jms_signed"]'::jsonb
    ),
    (
        'award_approval', 'rfctlarr_2013', 10, 'Award Approval',
        'collectorate_dept', 'additional_collector', 'District Collector / Competent Authority', 30,
        '["section_23_30_final_award_order", "compensation_apportionment_statement"]'::jsonb,
        '["compensation_calculation"]'::jsonb,
        'Formal Section 23/30 award approved under Collector DSC signature with apportionment sheet.',
        '["award_duly_signed", "within_12_months_of_declaration"]'::jsonb
    ),
    (
        'compensation_calculation', 'rfctlarr_2013', 11, 'Compensation Calculation',
        'finance_dept', 'finance_officer', 'Controller of Accounts', 15,
        '["market_value_computation_sheet", "solatium_100_percent_audit_sheet", "interest_accrual_statement"]'::jsonb,
        '["payment_processing"]'::jsonb,
        'First Schedule 100% Solatium computed and 12% p.a. additional interest accrued under Sec 30(3).',
        '["solatium_100_percent_verified", "interest_audited"]'::jsonb
    ),
    (
        'payment_processing', 'rfctlarr_2013', 12, 'Payment Processing',
        'finance_dept', 'finance_officer', 'Finance Division / PFMS', 30,
        '["pfms_sanction_order", "dbt_payment_advice", "bank_utr_acknowledgement"]'::jsonb,
        '["possession"]'::jsonb,
        'Direct Benefit Transfer disbursed through PFMS with live UTR numbers recorded.',
        '["all_awards_disbursed_or_deposited_in_authority"]'::jsonb
    ),
    (
        'possession', 'rfctlarr_2013', 13, 'Possession (Sec 38)',
        'collectorate_dept', 'collector', 'District Collector', 30,
        '["possession_memo", "panchnama_record", "handover_certificate"]'::jsonb,
        '["rr_completion"]'::jsonb,
        'Physical possession taken under Sec 38 after compensation payment; encumbrances extinguished.',
        '["compensation_paid_prior_to_possession"]'::jsonb
    ),
    (
        'rr_completion', 'rfctlarr_2013', 14, 'R&R Completion',
        'rr_dept', 'rr_officer', 'R&R Commissioner', 90,
        '["schedule_ii_entitlement_delivery_receipts", "housing_allotment_deed", "resettlement_site_clearance"]'::jsonb,
        '["project_closure"]'::jsonb,
        'Resettlement housing grants and subsistence allowances delivered to all affected families.',
        '["all_entitlements_delivered"]'::jsonb
    ),
    (
        'project_closure', 'rfctlarr_2013', 15, 'Project Closure',
        'government_oversight', 'government_reviewer', 'Central/State Ministry', 15,
        '["revenue_title_mutation_order", "final_audit_reconciliation_certificate", "project_handover_sign_off"]'::jsonb,
        '[]'::jsonb,
        'Land mutated in government revenue records; final audit closed; project archived.',
        '["title_mutated", "audit_complete"]'::jsonb
    )
ON CONFLICT (stage_code) DO UPDATE SET
    stage_name = EXCLUDED.stage_name,
    department_code = EXCLUDED.department_code,
    responsible_role = EXCLUDED.responsible_role,
    approval_authority = EXCLUDED.approval_authority,
    timeline_days = EXCLUDED.timeline_days,
    required_documents = EXCLUDED.required_documents,
    allowed_transitions = EXCLUDED.allowed_transitions,
    audit_requirements = EXCLUDED.audit_requirements;
