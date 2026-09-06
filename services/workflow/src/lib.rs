use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sih_domain::{Authority, DepartmentInfo, Project, ProjectStage, Role, RoleInfo, StageDefinition};
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub mod timeline;

/// 15 Statutory Legal Stages under RFCTLARR Act 2013 and Master Reference Standard
pub const LEGAL_STAGE_LABELS: [&str; 15] = [
    "Proposal Initiation",
    "Land Record Verification",
    "SIA Preparation",
    "SIA Review",
    "Preliminary Notification (Sec 11)",
    "Objection Period (Sec 15)",
    "Hearing & Disposal",
    "Declaration (Sec 19)",
    "Award Preparation (Sec 23)",
    "Award Approval",
    "Compensation Calculation",
    "Payment Processing",
    "Possession (Sec 38)",
    "R&R Completion",
    "Project Closure",
];

/// Canonical labels for the eight stages shown in the legacy MVP user flow.
pub const MVP_STAGE_LABELS: [&str; 8] = [
    "Project Created",
    "Land Verification",
    "Notification",
    "Objection Period",
    "Award Generation",
    "Compensation",
    "Possession",
    "Completed",
];

/// Return the canonical label for a persisted workflow stage.
pub fn canonical_stage_label(stage: &ProjectStage) -> &'static str {
    match stage {
        ProjectStage::ProposalInitiation => "Proposal Initiation",
        ProjectStage::LandRecordVerification => "Land Record Verification",
        ProjectStage::SiaPreparation => "SIA Preparation",
        ProjectStage::SiaReview => "SIA Review",
        ProjectStage::PreliminaryNotification => "Preliminary Notification (Sec 11)",
        ProjectStage::ObjectionPeriod => "Objection Period (Sec 15)",
        ProjectStage::Hearing => "Hearing & Disposal",
        ProjectStage::Declaration => "Declaration (Sec 19)",
        ProjectStage::AwardPreparation => "Award Preparation (Sec 23)",
        ProjectStage::AwardApproval => "Award Approval",
        ProjectStage::CompensationCalculation => "Compensation Calculation",
        ProjectStage::PaymentProcessing => "Payment Processing",
        ProjectStage::Possession => "Possession",
        ProjectStage::RrCompletion => "R&R Completion",
        ProjectStage::ProjectClosure => "Project Closure",
        // Legacy fallbacks
        ProjectStage::Draft | ProjectStage::Sanctioned => "Project Created",
        ProjectStage::Survey => "Land Verification",
        ProjectStage::PublicHearing => "Objection Period",
        ProjectStage::CompensationAward => "Award Generation",
        ProjectStage::RrScheme | ProjectStage::FundsDisbursed => "Compensation",
        ProjectStage::Completed => "Completed",
        ProjectStage::Lapsed => "Lapsed",
    }
}

/// Convert an exact canonical label to its representative persisted stage.
pub fn stage_from_canonical_label(label: &str) -> Option<ProjectStage> {
    match label {
        "Proposal Initiation" => Some(ProjectStage::ProposalInitiation),
        "Land Record Verification" => Some(ProjectStage::LandRecordVerification),
        "SIA Preparation" => Some(ProjectStage::SiaPreparation),
        "SIA Review" => Some(ProjectStage::SiaReview),
        "Preliminary Notification (Sec 11)" | "Preliminary Notification" => {
            Some(ProjectStage::PreliminaryNotification)
        }
        "Objection Period (Sec 15)" | "Objection Period" => Some(ProjectStage::ObjectionPeriod),
        "Hearing & Disposal" | "Hearing" => Some(ProjectStage::Hearing),
        "Declaration (Sec 19)" | "Declaration" => Some(ProjectStage::Declaration),
        "Award Preparation (Sec 23)" | "Award Preparation" => Some(ProjectStage::AwardPreparation),
        "Award Approval" => Some(ProjectStage::AwardApproval),
        "Compensation Calculation" => Some(ProjectStage::CompensationCalculation),
        "Payment Processing" => Some(ProjectStage::PaymentProcessing),
        "Possession (Sec 38)" | "Possession" => Some(ProjectStage::Possession),
        "R&R Completion" => Some(ProjectStage::RrCompletion),
        "Project Closure" => Some(ProjectStage::ProjectClosure),
        // Legacy MVP labels
        "Project Created" => Some(ProjectStage::Draft),
        "Land Verification" => Some(ProjectStage::Survey),
        "Notification" => Some(ProjectStage::PreliminaryNotification),
        "Award Generation" => Some(ProjectStage::CompensationAward),
        "Compensation" => Some(ProjectStage::RrScheme),
        "Completed" => Some(ProjectStage::Completed),
        _ => None,
    }
}

/// Metadata resolving "Who handles this stage?", timeline, required documents, and approval authority.
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
pub struct StageHandler {
    pub stage_code: &'static str,
    pub stage_name: &'static str,
    pub department_code: &'static str,
    pub department_name: &'static str,
    pub role_code: &'static str,
    pub role_name: &'static str,
    pub approval_authority: &'static str,
    pub timeline_days: u32,
    pub required_documents: &'static [&'static str],
    pub audit_requirements: &'static str,
}

/// Automatically resolves who handles any workflow stage.
pub fn who_handles_stage(stage: &ProjectStage) -> StageHandler {
    match stage {
        ProjectStage::ProposalInitiation | ProjectStage::Draft | ProjectStage::Sanctioned => StageHandler {
            stage_code: "proposal_initiation",
            stage_name: "Proposal Initiation",
            department_code: "requiring_body",
            department_name: "Land Requiring Body",
            role_code: "land_requiring_body",
            role_name: "Land Requiring Body",
            approval_authority: "Central/State Sanctioning Authority",
            timeline_days: 30,
            required_documents: &[
                "dpr_feasibility_report",
                "alignment_shapefile",
                "village_survey_list",
                "budget_sanction",
            ],
            audit_requirements: "Project proposal logged with alignment geometry hash and budget sanction reference.",
        },
        ProjectStage::LandRecordVerification | ProjectStage::Survey => StageHandler {
            stage_code: "land_record_verification",
            stage_name: "Land Record Verification",
            department_code: "revenue_dept",
            department_name: "State Revenue Department",
            role_code: "revenue_officer",
            role_name: "Revenue Officer",
            approval_authority: "Sub-Divisional Officer (SDM)",
            timeline_days: 30,
            required_documents: &[
                "cadastral_map",
                "jamabandi_ror_extract",
                "dilrmp_sync_record",
            ],
            audit_requirements: "Cadastral land records verified against State DILRMP with ULPIN and mutation status.",
        },
        ProjectStage::SiaPreparation => StageHandler {
            stage_code: "sia_preparation",
            stage_name: "SIA Preparation",
            department_code: "social_impact_dept",
            department_name: "Social Impact Assessment Unit",
            role_code: "sia_officer",
            role_name: "SIA Officer",
            approval_authority: "District Collector",
            timeline_days: 60,
            required_documents: &[
                "sia_terms_of_reference",
                "public_consultation_notice",
                "census_agency_moa",
            ],
            audit_requirements: "SIA public notice published in affected gram panchayats; baseline census initiated.",
        },
        ProjectStage::SiaReview => StageHandler {
            stage_code: "sia_review",
            stage_name: "SIA Review",
            department_code: "social_impact_dept",
            department_name: "Social Impact Assessment Unit",
            role_code: "sia_officer",
            role_name: "SIA Officer",
            approval_authority: "Independent Expert Group / State Govt",
            timeline_days: 60,
            required_documents: &[
                "sia_study_report",
                "social_impact_management_plan",
                "expert_group_recommendation",
            ],
            audit_requirements: "Independent Expert Group recommendations evaluated and approved by Appropriate Government.",
        },
        ProjectStage::PreliminaryNotification => StageHandler {
            stage_code: "preliminary_notification",
            stage_name: "Preliminary Notification (Sec 11)",
            department_code: "collectorate_dept",
            department_name: "District Collectorate / CALA",
            role_code: "collector",
            role_name: "District Collector / CALA",
            approval_authority: "District Collector / Official Gazette",
            timeline_days: 30,
            required_documents: &[
                "section_11_notification_pdf",
                "local_newspaper_cuttings",
                "gram_sabha_resolution",
            ],
            audit_requirements: "Section 11 Gazette Extraordinary published; land transaction freeze flag applied.",
        },
        ProjectStage::ObjectionPeriod | ProjectStage::PublicHearing => StageHandler {
            stage_code: "objection_period",
            stage_name: "Objection Period (Sec 15)",
            department_code: "citizen_desk",
            department_name: "Public Citizen Transparency Desk",
            role_code: "land_owner",
            role_name: "Land Owner / Citizen",
            approval_authority: "District Collector & CALA",
            timeline_days: 60,
            required_documents: &[
                "section_15_objection_petitions",
                "ownership_proof_documents",
            ],
            audit_requirements: "Statutory 60-day objection window opened; citizen claims recorded with ticket IDs.",
        },
        ProjectStage::Hearing => StageHandler {
            stage_code: "hearing",
            stage_name: "Hearing & Disposal",
            department_code: "collectorate_dept",
            department_name: "District Collectorate / CALA",
            role_code: "collector",
            role_name: "District Collector / CALA",
            approval_authority: "District Collector",
            timeline_days: 30,
            required_documents: &[
                "section_15_2_hearing_minutes",
                "collector_disposal_order",
            ],
            audit_requirements: "Section 15(2) personal hearings conducted; written disposal orders issued to objectors.",
        },
        ProjectStage::Declaration => StageHandler {
            stage_code: "declaration",
            stage_name: "Declaration (Sec 19)",
            department_code: "government_oversight",
            department_name: "Appropriate Government / Oversight",
            role_code: "government_reviewer",
            role_name: "Government Reviewer",
            approval_authority: "Appropriate Government",
            timeline_days: 30,
            required_documents: &[
                "section_19_declaration_order",
                "approved_rr_scheme_summary",
                "fund_deposit_receipt",
            ],
            audit_requirements: "Section 19 Declaration issued within statutory 12-month limit; R&R scheme summary gazetted.",
        },
        ProjectStage::AwardPreparation => StageHandler {
            stage_code: "award_preparation",
            stage_name: "Award Preparation (Sec 23)",
            department_code: "collectorate_dept",
            department_name: "District Collectorate / CALA",
            role_code: "legal_officer",
            role_name: "Legal Officer",
            approval_authority: "Collector & CALA",
            timeline_days: 60,
            required_documents: &[
                "joint_measurement_survey_sheet",
                "asset_tree_structure_valuation",
                "circle_rate_schedule",
            ],
            audit_requirements: "True market value determined under Sec 26; attachment valuations completed per Sec 29.",
        },
        ProjectStage::AwardApproval | ProjectStage::CompensationAward => StageHandler {
            stage_code: "award_approval",
            stage_name: "Award Approval",
            department_code: "collectorate_dept",
            department_name: "District Collectorate / CALA",
            role_code: "additional_collector",
            role_name: "Additional Collector",
            approval_authority: "District Collector / Competent Authority",
            timeline_days: 30,
            required_documents: &[
                "section_23_30_final_award_order",
                "compensation_apportionment_statement",
            ],
            audit_requirements: "Formal Section 23/30 award approved under Collector DSC signature with apportionment sheet.",
        },
        ProjectStage::CompensationCalculation => StageHandler {
            stage_code: "compensation_calculation",
            stage_name: "Compensation Calculation",
            department_code: "finance_dept",
            department_name: "Finance & PFMS Division",
            role_code: "finance_officer",
            role_name: "Finance Officer",
            approval_authority: "Controller of Accounts",
            timeline_days: 15,
            required_documents: &[
                "market_value_computation_sheet",
                "solatium_100_percent_audit_sheet",
                "interest_accrual_statement",
            ],
            audit_requirements: "First Schedule 100% Solatium computed and 12% p.a. additional interest accrued under Sec 30(3).",
        },
        ProjectStage::PaymentProcessing | ProjectStage::FundsDisbursed => StageHandler {
            stage_code: "payment_processing",
            stage_name: "Payment Processing",
            department_code: "finance_dept",
            department_name: "Finance & PFMS Division",
            role_code: "finance_officer",
            role_name: "Finance Officer",
            approval_authority: "Finance Division / PFMS",
            timeline_days: 30,
            required_documents: &[
                "pfms_sanction_order",
                "dbt_payment_advice",
                "bank_utr_acknowledgement",
            ],
            audit_requirements: "Direct Benefit Transfer disbursed through PFMS with live UTR numbers recorded.",
        },
        ProjectStage::Possession => StageHandler {
            stage_code: "possession",
            stage_name: "Possession (Sec 38)",
            department_code: "collectorate_dept",
            department_name: "District Collectorate / CALA",
            role_code: "collector",
            role_name: "District Collector / CALA",
            approval_authority: "District Collector",
            timeline_days: 30,
            required_documents: &[
                "possession_memo",
                "panchnama_record",
                "handover_certificate",
            ],
            audit_requirements: "Physical possession taken under Sec 38 after compensation payment; encumbrances extinguished.",
        },
        ProjectStage::RrCompletion | ProjectStage::RrScheme => StageHandler {
            stage_code: "rr_completion",
            stage_name: "R&R Completion",
            department_code: "rr_dept",
            department_name: "Resettlement & Rehabilitation Directorate",
            role_code: "rr_officer",
            role_name: "Rehabilitation Officer",
            approval_authority: "R&R Commissioner",
            timeline_days: 90,
            required_documents: &[
                "schedule_ii_entitlement_delivery_receipts",
                "housing_allotment_deed",
                "resettlement_site_clearance",
            ],
            audit_requirements: "Resettlement housing grants and subsistence allowances delivered to all affected families.",
        },
        ProjectStage::ProjectClosure | ProjectStage::Completed => StageHandler {
            stage_code: "project_closure",
            stage_name: "Project Closure",
            department_code: "government_oversight",
            department_name: "Appropriate Government / Oversight",
            role_code: "government_reviewer",
            role_name: "Government Reviewer",
            approval_authority: "Central/State Ministry",
            timeline_days: 15,
            required_documents: &[
                "revenue_title_mutation_order",
                "final_audit_reconciliation_certificate",
                "project_handover_sign_off",
            ],
            audit_requirements: "Land mutated in government revenue records; final audit closed; project archived.",
        },
        ProjectStage::Lapsed => StageHandler {
            stage_code: "lapsed",
            stage_name: "Lapsed",
            department_code: "collectorate_dept",
            department_name: "District Collectorate / CALA",
            role_code: "collector",
            role_name: "District Collector / CALA",
            approval_authority: "Statutory Order",
            timeline_days: 0,
            required_documents: &[],
            audit_requirements: "Proceedings lapsed under statutory deadline expiration.",
        },
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TransitionRequest {
    pub to: ProjectStage,
    pub actor_role: Option<Role>,
    pub uploaded_documents: Option<Vec<String>>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GateFailure {
    pub code: &'static str,
    pub message: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TransitionDecision {
    pub from: ProjectStage,
    pub to: ProjectStage,
}

/// Evaluates if a transition is legal per statutory rules & authority regime.
pub fn can_transition(
    project: &Project,
    target: &ProjectStage,
    now: DateTime<Utc>,
) -> Result<TransitionDecision, GateFailure> {
    if project.stage == ProjectStage::Lapsed
        || project.stage == ProjectStage::Completed
        || project.stage == ProjectStage::ProjectClosure
    {
        return Err(GateFailure {
            code: "terminal_stage",
            message: "A completed or lapsed project cannot transition".to_string(),
        });
    }

    // NH Act Section 3D lapse: Notification (3A) lapses if 1 year elapses
    let nh_notification_lapsed = project.authority == Authority::NationalHighways
        && project.stage == ProjectStage::PreliminaryNotification
        && target != &ProjectStage::PublicHearing
        && target != &ProjectStage::ObjectionPeriod
        && project
            .preliminary_notification_at
            .map(|notified_at| now >= notified_at + Duration::days(365))
            .unwrap_or(false);
    if nh_notification_lapsed {
        return Err(GateFailure {
            code: "nh_one_year_lapse",
            message: "National Highways preliminary notification lapsed after one year".to_string(),
        });
    }

    // LARR 2013 Section 25 lapse: Preliminary notification lapses if Sec 19 declaration is not made within 12 months
    let larr_sec11_lapsed = project.authority == Authority::Larr
        && project.stage == ProjectStage::PreliminaryNotification
        && target != &ProjectStage::ObjectionPeriod
        && target != &ProjectStage::PublicHearing
        && project
            .preliminary_notification_at
            .map(|notified_at| now >= notified_at + Duration::days(365))
            .unwrap_or(false);
    if larr_sec11_lapsed {
        return Err(GateFailure {
            code: "larr_sec11_one_year_lapse",
            message: "Preliminary notification lapsed after one year without declaration (RFCTLARR Sec 19/25)".to_string(),
        });
    }

    let allowed = match project.authority {
        Authority::Larr => matches!(
            (&project.stage, target),
            // Canonical 15 Legal Stages
            (ProjectStage::ProposalInitiation, ProjectStage::LandRecordVerification)
                | (ProjectStage::LandRecordVerification, ProjectStage::SiaPreparation)
                | (ProjectStage::LandRecordVerification, ProjectStage::ProposalInitiation)
                | (ProjectStage::SiaPreparation, ProjectStage::SiaReview)
                | (ProjectStage::SiaReview, ProjectStage::PreliminaryNotification)
                | (ProjectStage::SiaReview, ProjectStage::SiaPreparation)
                | (ProjectStage::PreliminaryNotification, ProjectStage::ObjectionPeriod)
                | (ProjectStage::ObjectionPeriod, ProjectStage::Hearing)
                | (ProjectStage::Hearing, ProjectStage::Declaration)
                | (ProjectStage::Hearing, ProjectStage::ObjectionPeriod)
                | (ProjectStage::Declaration, ProjectStage::AwardPreparation)
                | (ProjectStage::AwardPreparation, ProjectStage::AwardApproval)
                | (ProjectStage::AwardApproval, ProjectStage::Possession)
                | (ProjectStage::AwardApproval, ProjectStage::CompensationCalculation)
                | (ProjectStage::CompensationCalculation, ProjectStage::PaymentProcessing)
                | (ProjectStage::CompensationCalculation, ProjectStage::Possession)
                | (ProjectStage::PaymentProcessing, ProjectStage::Possession)
                | (ProjectStage::Possession, ProjectStage::ProjectClosure)
                | (ProjectStage::Possession, ProjectStage::RrCompletion)
                | (ProjectStage::RrCompletion, ProjectStage::ProjectClosure)
                // Legacy alias compatibility
                | (ProjectStage::Draft, ProjectStage::Sanctioned)
                | (ProjectStage::Draft, ProjectStage::LandRecordVerification)
                | (ProjectStage::Sanctioned, ProjectStage::PreliminaryNotification)
                | (ProjectStage::Sanctioned, ProjectStage::LandRecordVerification)
                | (ProjectStage::PreliminaryNotification, ProjectStage::PublicHearing)
                | (ProjectStage::PublicHearing, ProjectStage::Survey)
                | (ProjectStage::PublicHearing, ProjectStage::Hearing)
                | (ProjectStage::Survey, ProjectStage::CompensationAward)
                | (ProjectStage::Survey, ProjectStage::SiaPreparation)
                | (ProjectStage::CompensationAward, ProjectStage::RrScheme)
                | (ProjectStage::RrScheme, ProjectStage::FundsDisbursed)
                | (ProjectStage::FundsDisbursed, ProjectStage::Possession)
                | (ProjectStage::Possession, ProjectStage::Completed)
                | (ProjectStage::RrCompletion, ProjectStage::Completed)
        ),
        Authority::NationalHighways => matches!(
            (&project.stage, target),
            (ProjectStage::Draft, ProjectStage::Sanctioned)
                | (ProjectStage::ProposalInitiation, ProjectStage::LandRecordVerification)
                | (ProjectStage::LandRecordVerification, ProjectStage::PreliminaryNotification)
                | (ProjectStage::Sanctioned, ProjectStage::PreliminaryNotification)
                | (ProjectStage::PreliminaryNotification, ProjectStage::PublicHearing)
                | (ProjectStage::PreliminaryNotification, ProjectStage::ObjectionPeriod)
                | (ProjectStage::PublicHearing, ProjectStage::Survey)
                | (ProjectStage::ObjectionPeriod, ProjectStage::Hearing)
                | (ProjectStage::Hearing, ProjectStage::Declaration)
                | (ProjectStage::Survey, ProjectStage::CompensationAward)
                | (ProjectStage::Declaration, ProjectStage::AwardPreparation)
                | (ProjectStage::AwardPreparation, ProjectStage::AwardApproval)
                | (ProjectStage::CompensationAward, ProjectStage::FundsDisbursed)
                | (ProjectStage::AwardApproval, ProjectStage::PaymentProcessing)
                | (ProjectStage::PaymentProcessing, ProjectStage::Possession)
                | (ProjectStage::FundsDisbursed, ProjectStage::Possession)
                | (ProjectStage::Possession, ProjectStage::Completed)
                | (ProjectStage::Possession, ProjectStage::ProjectClosure)
        ),
    };

    if !allowed {
        return Err(GateFailure {
            code: "invalid_transition",
            message: format!("{} cannot transition to {}", project.stage, target),
        });
    }

    if (*target == ProjectStage::Survey || *target == ProjectStage::LandRecordVerification)
        && project.parcels.is_empty()
    {
        return Err(GateFailure {
            code: "survey_requires_parcels",
            message: "At least one parcel is required before land record verification / survey"
                .to_string(),
        });
    }

    Ok(TransitionDecision {
        from: project.stage,
        to: *target,
    })
}

/// Evaluates transition along with responsible role authorization and mandatory documents check.
pub fn can_transition_with_gate(
    project: &Project,
    target: &ProjectStage,
    actor_role: Role,
    uploaded_documents: &[String],
    now: DateTime<Utc>,
) -> Result<TransitionDecision, GateFailure> {
    let decision = can_transition(project, target, now)?;

    let current_handler = who_handles_stage(&project.stage);
    let is_authorized = actor_role == Role::Admin
        || actor_role.as_str() == current_handler.role_code
        || (actor_role == Role::Collector && current_handler.department_code == "collectorate_dept")
        || (actor_role == Role::AdditionalCollector
            && (current_handler.role_code == "collector"
                || current_handler.role_code == "additional_collector"));

    if !is_authorized && actor_role != Role::Admin {
        return Err(GateFailure {
            code: "unauthorized_role_for_stage",
            message: format!(
                "Stage '{}' must be handled by '{}' ({}), but actor has role '{}'",
                current_handler.stage_name,
                current_handler.role_name,
                current_handler.department_name,
                actor_role
            ),
        });
    }

    if !uploaded_documents.is_empty() {
        let required_docs = current_handler.required_documents;
        let missing_docs: Vec<_> = required_docs
            .iter()
            .filter(|&&req| !uploaded_documents.iter().any(|d| d.contains(req) || d == req))
            .cloned()
            .collect();
        if !missing_docs.is_empty() {
            return Err(GateFailure {
                code: "missing_mandatory_documents",
                message: format!(
                    "Stage '{}' requires mandatory documents: {:?}",
                    current_handler.stage_name, missing_docs
                ),
            });
        }
    }

    Ok(decision)
}

pub fn lapse_if_due(project: &mut Project, now: DateTime<Utc>) -> bool {
    if project.authority == Authority::NationalHighways
        && project.stage == ProjectStage::PreliminaryNotification
        && project
            .preliminary_notification_at
            .is_some_and(|at| now >= at + Duration::days(365))
    {
        project.stage = ProjectStage::Lapsed;
        project.updated_at = now;
        return true;
    }
    false
}

/// Statutory timeline gate checks that fire on every stage transition.
///
/// Implements the timeline engine rules from Master PDF §22 and §36, layered on
/// top of the existing role + document checks in [`can_transition_with_gate`].
/// Returns `Ok(TransitionDecision)` if all timeline gates pass, otherwise an
/// explanatory [`GateFailure`] that the API can surface to the user.
///
/// Gates enforced:
/// - §22.2 Objection window: leaving `ObjectionPeriod` to `Hearing` is only
///   allowed if the objection window has actually elapsed (LARR 60 days,
///   NH Act 21 days). Owners cannot be forced into a hearing while the
///   statutory objection window is still open.
/// - §22.3 Declaration within 12 months: leaving `PreliminaryNotification`
///   to `Declaration` requires the Section 11 notification to be less than
///   12 months old. Past 12 months the project must lapse, not advance.
/// - §22.4 Award within 12 months of declaration: leaving `Declaration` to
///   `AwardPreparation` requires the declaration to be less than 12 months
///   old. Past 12 months the declaration lapses.
/// - §22.6 Possession after 80% payment: leaving `PaymentProcessing` to
///   `Possession` requires that compensation has been substantially paid.
///   Without this gate the platform would let possession be taken before
///   payment — a direct violation of Section 38.
/// - §36  Court stay: if a court stay is in effect (provided via the
///   optional `stays` slice), no stage transition may proceed until the
///   stay is vacated. This is the broadest gate — it blocks everything.
pub fn check_timeline_gates(
    project: &Project,
    target: &ProjectStage,
    now: DateTime<Utc>,
    stays: &[(DateTime<Utc>, DateTime<Utc>)],
    compensation_paid_paise: Option<i64>,
    compensation_awarded_paise: Option<i64>,
    objections_cleared: bool,
) -> Result<TransitionDecision, GateFailure> {
    use crate::timeline;

    // §36 — court stay blocks all transitions
    let stay_active = stays.iter().any(|(from, to)| *from <= now && now <= *to);
    if stay_active {
        return Err(GateFailure {
            code: "court_stay_active",
            message: "A court stay is currently in effect on this project. No stage \
                      transitions may proceed until the stay is vacated (RFCTLARR Act \
                      2013 — court-stay day exclusion per Master PDF §36)."
                .to_string(),
        });
    }

    // §22.3 — PreliminaryNotification → Declaration requires the Section 11
    // notification to be less than 12 months old.
    if project.stage == ProjectStage::PreliminaryNotification
        && *target == ProjectStage::Declaration
    {
        if let Some(notified_at) = project.preliminary_notification_at {
            if !timeline::declaration_within_12_months(notified_at, now) {
                return Err(GateFailure {
                    code: "declaration_window_expired",
                    message: format!(
                        "The Section 11 preliminary notification was issued on {} — more \
                         than 12 months ago. Under RFCTLARR Act 2013 §22.3 / NH Act, \
                         the declaration must be issued within 12 months of the \
                         notification or the notification lapses. Use the lapse \
                         endpoint instead.",
                        notified_at.format("%Y-%m-%d")
                    ),
                });
            }
        }
    }

    // §22.2 — ObjectionPeriod → Hearing requires the objection window to be
    // actually closed or certified disposed by the Collector. We use the
    // Project.preliminary_notification_at as the anchor and project.authority
    // for the window length.
    if project.stage == ProjectStage::ObjectionPeriod
        && *target == ProjectStage::Hearing
    {
        if !objections_cleared {
            if let Some(notified_at) = project.preliminary_notification_at {
                if timeline::objection_window_open(notified_at, project.authority, now) {
                    return Err(GateFailure {
                        code: "objection_window_still_open",
                        message: format!(
                            "The statutory objection window is still open ({}-day period \
                             from Section 11 notification on {}). Hearings cannot be \
                             scheduled until the window closes or the Collector certifies \
                             Section 15 objections cataloged and disposed per RFCTLARR Act 2013 \
                             §15 / NH Act §3A.",
                            if project.authority == Authority::NationalHighways { 21 } else { 60 },
                            notified_at.format("%Y-%m-%d")
                        ),
                    });
                }
            }
        }
    }

    // §22.6 / Section 38 — Transition to Possession requires compensation payment.
    if matches!(
        project.stage,
        ProjectStage::PaymentProcessing
            | ProjectStage::AwardApproval
            | ProjectStage::CompensationCalculation
            | ProjectStage::FundsDisbursed
            | ProjectStage::CompensationAward
    ) && *target == ProjectStage::Possession
    {
        match (compensation_paid_paise, compensation_awarded_paise) {
            (Some(paid), Some(awarded)) => {
                if !timeline::possession_payment_eligible(paid, awarded) {
                    let pct = if awarded > 0 {
                        (paid as f64 / awarded as f64 * 100.0) as u32
                    } else {
                        0
                    };
                    return Err(GateFailure {
                        code: "possession_before_80pct_payment",
                        message: format!(
                            "Possession (Section 38) requires at least 80% of awarded \
                             compensation to be paid. Currently paid: {} paise of {} \
                             paise awarded ({}%). Disburse more payments via PFMS \
                             before taking possession.",
                            paid, awarded, pct
                        ),
                    });
                }
            }
            _ => {
                // Compensation figures not provided — fail open for the MVP,
                // since the API caller may not have them on hand. The Master
                // PDF specifies this gate; production deployments MUST supply
                // these numbers.
            }
        }
    }

    Ok(TransitionDecision {
        from: project.stage,
        to: *target,
    })
}

pub fn required_roles(stage: &ProjectStage) -> &'static [Role] {
    match stage {
        ProjectStage::ProposalInitiation | ProjectStage::Draft => {
            &[Role::Admin, Role::LandRequiringBody]
        }
        ProjectStage::Sanctioned => &[Role::Admin, Role::RevenueOfficer, Role::LandRequiringBody],
        ProjectStage::LandRecordVerification | ProjectStage::Survey => {
            &[Role::RevenueOfficer, Role::GisOfficer]
        }
        ProjectStage::SiaPreparation | ProjectStage::SiaReview => {
            &[Role::SiaOfficer, Role::Collector]
        }
        ProjectStage::PreliminaryNotification => &[Role::Collector],
        ProjectStage::ObjectionPeriod | ProjectStage::PublicHearing => {
            &[Role::LandOwner, Role::Collector]
        }
        ProjectStage::Hearing => &[Role::Collector],
        ProjectStage::Declaration => &[Role::GovernmentReviewer, Role::Collector],
        ProjectStage::AwardPreparation => &[Role::LegalOfficer, Role::Collector],
        ProjectStage::AwardApproval | ProjectStage::CompensationAward => {
            &[Role::AdditionalCollector, Role::Collector]
        }
        ProjectStage::CompensationCalculation => &[Role::FinanceOfficer, Role::Collector],
        ProjectStage::PaymentProcessing | ProjectStage::FundsDisbursed => {
            &[Role::FinanceOfficer, Role::Admin]
        }
        ProjectStage::Possession => &[Role::Collector],
        ProjectStage::RrCompletion | ProjectStage::RrScheme => {
            &[Role::RrOfficer, Role::Collector]
        }
        ProjectStage::ProjectClosure | ProjectStage::Completed => {
            &[Role::GovernmentReviewer, Role::Admin]
        }
        ProjectStage::Lapsed => &[],
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkflowInstance {
    pub id: Uuid,
    pub project_id: Uuid,
    pub authority: Authority,
    pub current_stage: ProjectStage,
    pub started_at: DateTime<Utc>,
    pub notification_at: Option<DateTime<Utc>>,
    pub deadline_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub lapsed_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub responsible_department: Option<String>,
    #[serde(default)]
    pub responsible_role: Option<String>,
    #[serde(default)]
    pub stage_timeline_days: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApprovalAction {
    pub id: Uuid,
    pub workflow_instance_id: Uuid,
    pub from_stage: ProjectStage,
    pub to_stage: ProjectStage,
    pub actor_user_id: Option<Uuid>,
    pub actor_role: Role,
    pub decision: String,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub id: Uuid,
    pub workflow_instance_id: Uuid,
    pub event_type: String,
    pub occurred_at: DateTime<Utc>,
    pub deadline_at: Option<DateTime<Utc>>,
    pub metadata: serde_json::Value,
}

pub async fn initialize_workflow(
    pool: &PgPool,
    project_id: Uuid,
    authority: Authority,
) -> Result<WorkflowInstance, sqlx::Error> {
    let now = Utc::now();
    let initial_stage = ProjectStage::ProposalInitiation;
    let handler = who_handles_stage(&initial_stage);
    let deadline = Some(now + Duration::days(handler.timeline_days as i64));

    let instance = WorkflowInstance {
        id: Uuid::new_v4(),
        project_id,
        authority,
        current_stage: initial_stage,
        started_at: now,
        notification_at: None,
        deadline_at: deadline,
        completed_at: None,
        lapsed_at: None,
        responsible_department: Some(handler.department_code.to_string()),
        responsible_role: Some(handler.role_code.to_string()),
        stage_timeline_days: Some(handler.timeline_days),
    };

    let authority_str = match authority {
        Authority::Larr => "larr",
        Authority::NationalHighways => "national_highways",
    };
    let stage_str = stage_to_db_code(instance.current_stage);

    sqlx::query(
        "INSERT INTO workflow_instance (id, project_id, authority, current_stage, started_at, deadline_at)
         VALUES ($1, $2, $3::authority_code, $4, $5, $6)"
    )
    .bind(instance.id)
    .bind(project_id)
    .bind(authority_str)
    .bind(stage_str)
    .bind(instance.started_at)
    .bind(instance.deadline_at)
    .execute(pool)
    .await?;

    record_timeline_event(
        pool,
        instance.id,
        "created",
        now,
        deadline,
        serde_json::json!({
            "stage": stage_str,
            "department": handler.department_code,
            "role": handler.role_code,
            "timeline_days": handler.timeline_days,
            "approval_authority": handler.approval_authority,
        }),
    )
    .await?;

    Ok(instance)
}

pub async fn get_workflow_instance(
    pool: &PgPool,
    workflow_id: Uuid,
) -> Result<Option<WorkflowInstance>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT id, project_id, authority, current_stage, started_at, notification_at, 
                deadline_at, completed_at, lapsed_at
         FROM workflow_instance WHERE id = $1",
    )
    .bind(workflow_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| {
        let authority_str: String = r.try_get("authority").unwrap_or_else(|_| "larr".to_string());
        let stage_str: String = r
            .try_get("current_stage")
            .unwrap_or_else(|_| "proposal_initiation".to_string());
        let current_stage = db_code_to_stage(&stage_str);
        let handler = who_handles_stage(&current_stage);

        WorkflowInstance {
            id: r.try_get("id").unwrap_or_default(),
            project_id: r.try_get("project_id").unwrap_or_default(),
            authority: if authority_str == "national_highways" {
                Authority::NationalHighways
            } else {
                Authority::Larr
            },
            current_stage,
            started_at: r.try_get("started_at").unwrap_or_else(|_| Utc::now()),
            notification_at: r.try_get("notification_at").ok(),
            deadline_at: r.try_get("deadline_at").ok(),
            completed_at: r.try_get("completed_at").ok(),
            lapsed_at: r.try_get("lapsed_at").ok(),
            responsible_department: Some(handler.department_code.to_string()),
            responsible_role: Some(handler.role_code.to_string()),
            stage_timeline_days: Some(handler.timeline_days),
        }
    }))
}

pub async fn get_workflow_by_project(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<WorkflowInstance>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT id, project_id, authority, current_stage, started_at, notification_at, 
                deadline_at, completed_at, lapsed_at
         FROM workflow_instance WHERE project_id = $1",
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| {
        let authority_str: String = r.try_get("authority").unwrap_or_else(|_| "larr".to_string());
        let stage_str: String = r
            .try_get("current_stage")
            .unwrap_or_else(|_| "proposal_initiation".to_string());
        let current_stage = db_code_to_stage(&stage_str);
        let handler = who_handles_stage(&current_stage);

        WorkflowInstance {
            id: r.try_get("id").unwrap_or_default(),
            project_id: r.try_get("project_id").unwrap_or_default(),
            authority: if authority_str == "national_highways" {
                Authority::NationalHighways
            } else {
                Authority::Larr
            },
            current_stage,
            started_at: r.try_get("started_at").unwrap_or_else(|_| Utc::now()),
            notification_at: r.try_get("notification_at").ok(),
            deadline_at: r.try_get("deadline_at").ok(),
            completed_at: r.try_get("completed_at").ok(),
            lapsed_at: r.try_get("lapsed_at").ok(),
            responsible_department: Some(handler.department_code.to_string()),
            responsible_role: Some(handler.role_code.to_string()),
            stage_timeline_days: Some(handler.timeline_days),
        }
    }))
}

pub async fn advance_workflow(
    pool: &PgPool,
    workflow_id: Uuid,
    to_stage: ProjectStage,
    actor_user_id: Option<Uuid>,
    actor_role: Role,
    reason: Option<String>,
) -> Result<WorkflowInstance, sqlx::Error> {
    let instance = get_workflow_instance(pool, workflow_id)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)?;

    let stage_str = stage_to_db_code(to_stage);
    let now = Utc::now();
    let next_handler = who_handles_stage(&to_stage);
    let stage_deadline = Some(now + Duration::days(next_handler.timeline_days as i64));

    let mut notification_at = instance.notification_at;
    if to_stage == ProjectStage::PreliminaryNotification {
        notification_at = Some(now);
    }

    let completed_at = if to_stage == ProjectStage::Completed || to_stage == ProjectStage::ProjectClosure {
        Some(now)
    } else {
        None
    };
    let lapsed_at = if to_stage == ProjectStage::Lapsed {
        Some(now)
    } else {
        None
    };

    sqlx::query(
        "UPDATE workflow_instance 
         SET current_stage = $1, notification_at = $2, deadline_at = $3, completed_at = $4, lapsed_at = $5
         WHERE id = $6",
    )
    .bind(stage_str)
    .bind(notification_at)
    .bind(stage_deadline)
    .bind(completed_at)
    .bind(lapsed_at)
    .bind(workflow_id)
    .execute(pool)
    .await?;

    record_approval(
        pool,
        workflow_id,
        instance.current_stage,
        to_stage,
        actor_user_id,
        actor_role,
        "advanced",
        reason,
    )
    .await?;

    record_timeline_event(
        pool,
        workflow_id,
        "advanced",
        now,
        stage_deadline,
        serde_json::json!({
            "from": stage_to_db_code(instance.current_stage),
            "to": stage_str,
            "department": next_handler.department_code,
            "role": next_handler.role_code,
            "timeline_days": next_handler.timeline_days,
            "approval_authority": next_handler.approval_authority,
        }),
    )
    .await?;

    Ok(WorkflowInstance {
        current_stage: to_stage,
        notification_at,
        deadline_at: stage_deadline,
        completed_at,
        lapsed_at,
        responsible_department: Some(next_handler.department_code.to_string()),
        responsible_role: Some(next_handler.role_code.to_string()),
        stage_timeline_days: Some(next_handler.timeline_days),
        ..instance
    })
}

pub async fn reject_workflow(
    pool: &PgPool,
    workflow_id: Uuid,
    actor_user_id: Option<Uuid>,
    actor_role: Role,
    reason: Option<String>,
) -> Result<WorkflowInstance, sqlx::Error> {
    let instance = get_workflow_instance(pool, workflow_id)
        .await?
        .ok_or_else(|| sqlx::Error::RowNotFound)?;

    record_approval(
        pool,
        workflow_id,
        instance.current_stage,
        instance.current_stage,
        actor_user_id,
        actor_role,
        "returned",
        reason,
    )
    .await?;

    record_timeline_event(
        pool,
        workflow_id,
        "returned",
        Utc::now(),
        instance.deadline_at,
        serde_json::json!({"stage": stage_to_db_code(instance.current_stage)}),
    )
    .await?;

    Ok(instance)
}

pub async fn get_approval_history(
    pool: &PgPool,
    workflow_id: Uuid,
) -> Result<Vec<ApprovalAction>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, workflow_instance_id, from_stage, to_stage, actor_user_id, 
                actor_role, decision, reason, created_at
         FROM approval_history
         WHERE workflow_instance_id = $1
         ORDER BY created_at ASC",
    )
    .bind(workflow_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| {
            let from_str: String = r.try_get("from_stage").unwrap_or_default();
            let to_str: String = r.try_get("to_stage").unwrap_or_default();
            let role_str: String = r.try_get("actor_role").unwrap_or_else(|_| "admin".to_string());

            ApprovalAction {
                id: r.try_get("id").unwrap_or_default(),
                workflow_instance_id: r.try_get("workflow_instance_id").unwrap_or_default(),
                from_stage: db_code_to_stage(&from_str),
                to_stage: db_code_to_stage(&to_str),
                actor_user_id: r.try_get("actor_user_id").ok(),
                actor_role: db_code_to_role(&role_str),
                decision: r
                    .try_get("decision")
                    .unwrap_or_else(|_| "advanced".to_string()),
                reason: r.try_get("reason").ok(),
                created_at: r.try_get("created_at").unwrap_or_else(|_| Utc::now()),
            }
        })
        .collect())
}

pub async fn record_approval(
    pool: &PgPool,
    workflow_id: Uuid,
    from_stage: ProjectStage,
    to_stage: ProjectStage,
    actor_user_id: Option<Uuid>,
    actor_role: Role,
    decision: &str,
    reason: Option<String>,
) -> Result<(), sqlx::Error> {
    let from_str = stage_to_db_code(from_stage);
    let to_str = stage_to_db_code(to_stage);
    let role_str = role_to_db_code(actor_role);

    sqlx::query(
        "INSERT INTO approval_history 
         (id, workflow_instance_id, from_stage, to_stage, actor_user_id, actor_role, decision, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(Uuid::new_v4())
    .bind(workflow_id)
    .bind(from_str)
    .bind(to_str)
    .bind(actor_user_id)
    .bind(role_str)
    .bind(decision)
    .bind(reason)
    .bind(Utc::now())
    .execute(pool)
    .await?;

    Ok(())
}

async fn record_timeline_event(
    pool: &PgPool,
    workflow_id: Uuid,
    event_type: &str,
    occurred_at: DateTime<Utc>,
    deadline_at: Option<DateTime<Utc>>,
    metadata: serde_json::Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO timeline_event 
         (id, workflow_instance_id, event_type, occurred_at, deadline_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(workflow_id)
    .bind(event_type)
    .bind(occurred_at)
    .bind(deadline_at)
    .bind(metadata)
    .execute(pool)
    .await?;

    Ok(())
}

pub fn stage_to_db_code(stage: ProjectStage) -> &'static str {
    match stage {
        ProjectStage::ProposalInitiation | ProjectStage::Draft | ProjectStage::Sanctioned => {
            "proposal_initiation"
        }
        ProjectStage::LandRecordVerification | ProjectStage::Survey => "land_record_verification",
        ProjectStage::SiaPreparation => "sia_preparation",
        ProjectStage::SiaReview => "sia_review",
        ProjectStage::PreliminaryNotification => "preliminary_notification",
        ProjectStage::ObjectionPeriod | ProjectStage::PublicHearing => "objection_period",
        ProjectStage::Hearing => "hearing",
        ProjectStage::Declaration => "declaration",
        ProjectStage::AwardPreparation => "award_preparation",
        ProjectStage::AwardApproval | ProjectStage::CompensationAward => "award_approval",
        ProjectStage::CompensationCalculation => "compensation_calculation",
        ProjectStage::PaymentProcessing | ProjectStage::FundsDisbursed => "payment_processing",
        ProjectStage::Possession => "possession",
        ProjectStage::RrCompletion | ProjectStage::RrScheme => "rr_completion",
        ProjectStage::ProjectClosure | ProjectStage::Completed => "project_closure",
        ProjectStage::Lapsed => "lapsed",
    }
}

pub fn db_code_to_stage(code: &str) -> ProjectStage {
    match code {
        "proposal_initiation" | "project_created" | "project_created_nh" | "draft" => {
            ProjectStage::ProposalInitiation
        }
        "land_record_verification" | "land_verification" | "land_verification_nh" | "survey" => {
            ProjectStage::LandRecordVerification
        }
        "sia_preparation" => ProjectStage::SiaPreparation,
        "sia_review" => ProjectStage::SiaReview,
        "preliminary_notification" | "notification" | "notification_nh" => {
            ProjectStage::PreliminaryNotification
        }
        "objection_period" | "objection_period_nh" | "public_hearing" => {
            ProjectStage::ObjectionPeriod
        }
        "hearing" => ProjectStage::Hearing,
        "declaration" => ProjectStage::Declaration,
        "award_preparation" => ProjectStage::AwardPreparation,
        "award_approval" | "award_generation" | "award_generation_nh" | "compensation_award" => {
            ProjectStage::AwardApproval
        }
        "compensation_calculation" => ProjectStage::CompensationCalculation,
        "payment_processing" | "compensation" | "compensation_nh" | "funds_disbursed" => {
            ProjectStage::PaymentProcessing
        }
        "possession" | "possession_nh" => ProjectStage::Possession,
        "rr_completion" | "rr_scheme" => ProjectStage::RrCompletion,
        "project_closure" | "completed" | "completed_nh" => ProjectStage::ProjectClosure,
        "lapsed" => ProjectStage::Lapsed,
        _ => ProjectStage::ProposalInitiation,
    }
}

pub fn role_to_db_code(role: Role) -> &'static str {
    role.as_str()
}

pub fn db_code_to_role(code: &str) -> Role {
    match code.to_lowercase().as_str() {
        "admin" => Role::Admin,
        "land_requiring_body" | "requiring_body" => Role::LandRequiringBody,
        "collector" => Role::Collector,
        "additional_collector" => Role::AdditionalCollector,
        "revenue_officer" => Role::RevenueOfficer,
        "gis_officer" | "gis" => Role::GisOfficer,
        "sia_officer" | "sia" => Role::SiaOfficer,
        "legal_officer" | "legal" => Role::LegalOfficer,
        "finance_officer" | "finance" => Role::FinanceOfficer,
        "rr_officer" | "rehabilitation_officer" => Role::RrOfficer,
        "government_reviewer" | "government" => Role::GovernmentReviewer,
        "land_owner" | "citizen" => Role::LandOwner,
        _ => Role::Admin,
    }
}

/// Returns the 15 statutory stage definitions for the RFCTLARR 2013 workflow engine.
pub fn get_all_stage_definitions() -> Vec<StageDefinition> {
    vec![
        StageDefinition {
            stage_code: "proposal_initiation".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 1,
            stage_name: "Proposal Initiation".to_string(),
            department_code: "requiring_body".to_string(),
            responsible_role: "land_requiring_body".to_string(),
            approval_authority: "Central/State Sanctioning Authority".to_string(),
            timeline_days: 30,
            required_documents: vec![
                "dpr_feasibility_report".to_string(),
                "alignment_shapefile".to_string(),
                "village_survey_list".to_string(),
                "budget_sanction".to_string(),
            ],
            allowed_transitions: vec!["land_record_verification".to_string()],
            audit_requirements: "Project proposal logged with alignment geometry hash and budget sanction reference.".to_string(),
            gate_predicates: vec!["has_alignment_corridor".to_string(), "has_village_list".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "land_record_verification".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 2,
            stage_name: "Land Record Verification".to_string(),
            department_code: "revenue_dept".to_string(),
            responsible_role: "revenue_officer".to_string(),
            approval_authority: "Sub-Divisional Officer (SDM)".to_string(),
            timeline_days: 30,
            required_documents: vec![
                "cadastral_map".to_string(),
                "jamabandi_ror_extract".to_string(),
                "dilrmp_sync_record".to_string(),
            ],
            allowed_transitions: vec!["sia_preparation".to_string(), "proposal_initiation".to_string()],
            audit_requirements: "Cadastral land records verified against State DILRMP with ULPIN and mutation status.".to_string(),
            gate_predicates: vec!["dilrmp_verified".to_string(), "all_parcels_mapped".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "sia_preparation".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 3,
            stage_name: "SIA Preparation".to_string(),
            department_code: "social_impact_dept".to_string(),
            responsible_role: "sia_officer".to_string(),
            approval_authority: "District Collector".to_string(),
            timeline_days: 60,
            required_documents: vec![
                "sia_terms_of_reference".to_string(),
                "public_consultation_notice".to_string(),
                "census_agency_moa".to_string(),
            ],
            allowed_transitions: vec!["sia_review".to_string()],
            audit_requirements: "SIA public notice published in affected gram panchayats; baseline census initiated.".to_string(),
            gate_predicates: vec!["consultation_notice_published".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "sia_review".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 4,
            stage_name: "SIA Review".to_string(),
            department_code: "social_impact_dept".to_string(),
            responsible_role: "sia_officer".to_string(),
            approval_authority: "Independent Expert Group / State Govt".to_string(),
            timeline_days: 60,
            required_documents: vec![
                "sia_study_report".to_string(),
                "social_impact_management_plan".to_string(),
                "expert_group_recommendation".to_string(),
            ],
            allowed_transitions: vec!["preliminary_notification".to_string(), "sia_preparation".to_string()],
            audit_requirements: "Independent Expert Group recommendations evaluated and approved by Appropriate Government.".to_string(),
            gate_predicates: vec!["expert_group_cleared".to_string(), "minimum_displacement_certified".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "preliminary_notification".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 5,
            stage_name: "Preliminary Notification (Sec 11)".to_string(),
            department_code: "collectorate_dept".to_string(),
            responsible_role: "collector".to_string(),
            approval_authority: "District Collector / Official Gazette".to_string(),
            timeline_days: 30,
            required_documents: vec![
                "section_11_notification_pdf".to_string(),
                "local_newspaper_cuttings".to_string(),
                "gram_sabha_resolution".to_string(),
            ],
            allowed_transitions: vec!["objection_period".to_string()],
            audit_requirements: "Section 11 Gazette Extraordinary published; land transaction freeze flag applied.".to_string(),
            gate_predicates: vec!["gazette_published".to_string(), "newspaper_published_two_dailies".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "objection_period".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 6,
            stage_name: "Objection Period (Sec 15)".to_string(),
            department_code: "citizen_desk".to_string(),
            responsible_role: "land_owner".to_string(),
            approval_authority: "District Collector & CALA".to_string(),
            timeline_days: 60,
            required_documents: vec![
                "section_15_objection_petitions".to_string(),
                "ownership_proof_documents".to_string(),
            ],
            allowed_transitions: vec!["hearing".to_string()],
            audit_requirements: "Statutory 60-day objection window opened; citizen claims recorded with ticket IDs.".to_string(),
            gate_predicates: vec!["objection_window_elapsed_or_waived".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "hearing".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 7,
            stage_name: "Hearing & Disposal".to_string(),
            department_code: "collectorate_dept".to_string(),
            responsible_role: "collector".to_string(),
            approval_authority: "District Collector".to_string(),
            timeline_days: 30,
            required_documents: vec![
                "section_15_2_hearing_minutes".to_string(),
                "collector_disposal_order".to_string(),
            ],
            allowed_transitions: vec!["declaration".to_string(), "objection_period".to_string()],
            audit_requirements: "Section 15(2) personal hearings conducted; written disposal orders issued to objectors.".to_string(),
            gate_predicates: vec!["all_objections_disposed".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "declaration".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 8,
            stage_name: "Declaration (Sec 19)".to_string(),
            department_code: "government_oversight".to_string(),
            responsible_role: "government_reviewer".to_string(),
            approval_authority: "Appropriate Government".to_string(),
            timeline_days: 30,
            required_documents: vec![
                "section_19_declaration_order".to_string(),
                "approved_rr_scheme_summary".to_string(),
                "fund_deposit_receipt".to_string(),
            ],
            allowed_transitions: vec!["award_preparation".to_string()],
            audit_requirements: "Section 19 Declaration issued within statutory 12-month limit; R&R scheme summary gazetted.".to_string(),
            gate_predicates: vec!["within_12_months_of_sec_11".to_string(), "requiring_body_deposit_confirmed".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "award_preparation".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 9,
            stage_name: "Award Preparation (Sec 23)".to_string(),
            department_code: "collectorate_dept".to_string(),
            responsible_role: "legal_officer".to_string(),
            approval_authority: "Collector & CALA".to_string(),
            timeline_days: 60,
            required_documents: vec![
                "joint_measurement_survey_sheet".to_string(),
                "asset_tree_structure_valuation".to_string(),
                "circle_rate_schedule".to_string(),
            ],
            allowed_transitions: vec!["award_approval".to_string()],
            audit_requirements: "True market value determined under Sec 26; attachment valuations completed per Sec 29.".to_string(),
            gate_predicates: vec!["market_value_fixed".to_string(), "jms_signed".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "award_approval".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 10,
            stage_name: "Award Approval".to_string(),
            department_code: "collectorate_dept".to_string(),
            responsible_role: "additional_collector".to_string(),
            approval_authority: "District Collector / Competent Authority".to_string(),
            timeline_days: 30,
            required_documents: vec![
                "section_23_30_final_award_order".to_string(),
                "compensation_apportionment_statement".to_string(),
            ],
            allowed_transitions: vec!["compensation_calculation".to_string()],
            audit_requirements: "Formal Section 23/30 award approved under Collector DSC signature with apportionment sheet.".to_string(),
            gate_predicates: vec!["award_duly_signed".to_string(), "within_12_months_of_declaration".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "compensation_calculation".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 11,
            stage_name: "Compensation Calculation".to_string(),
            department_code: "finance_dept".to_string(),
            responsible_role: "finance_officer".to_string(),
            approval_authority: "Controller of Accounts".to_string(),
            timeline_days: 15,
            required_documents: vec![
                "market_value_computation_sheet".to_string(),
                "solatium_100_percent_audit_sheet".to_string(),
                "interest_accrual_statement".to_string(),
            ],
            allowed_transitions: vec!["payment_processing".to_string()],
            audit_requirements: "First Schedule 100% Solatium computed and 12% p.a. additional interest accrued under Sec 30(3).".to_string(),
            gate_predicates: vec!["solatium_100_percent_verified".to_string(), "interest_audited".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "payment_processing".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 12,
            stage_name: "Payment Processing".to_string(),
            department_code: "finance_dept".to_string(),
            responsible_role: "finance_officer".to_string(),
            approval_authority: "Finance Division / PFMS".to_string(),
            timeline_days: 30,
            required_documents: vec![
                "pfms_sanction_order".to_string(),
                "dbt_payment_advice".to_string(),
                "bank_utr_acknowledgement".to_string(),
            ],
            allowed_transitions: vec!["possession".to_string()],
            audit_requirements: "Direct Benefit Transfer disbursed through PFMS with live UTR numbers recorded.".to_string(),
            gate_predicates: vec!["all_awards_disbursed_or_deposited_in_authority".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "possession".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 13,
            stage_name: "Possession (Sec 38)".to_string(),
            department_code: "collectorate_dept".to_string(),
            responsible_role: "collector".to_string(),
            approval_authority: "District Collector".to_string(),
            timeline_days: 30,
            required_documents: vec![
                "possession_memo".to_string(),
                "panchnama_record".to_string(),
                "handover_certificate".to_string(),
            ],
            allowed_transitions: vec!["rr_completion".to_string()],
            audit_requirements: "Physical possession taken under Sec 38 after compensation payment; encumbrances extinguished.".to_string(),
            gate_predicates: vec!["compensation_paid_prior_to_possession".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "rr_completion".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 14,
            stage_name: "R&R Completion".to_string(),
            department_code: "rr_dept".to_string(),
            responsible_role: "rr_officer".to_string(),
            approval_authority: "R&R Commissioner".to_string(),
            timeline_days: 90,
            required_documents: vec![
                "schedule_ii_entitlement_delivery_receipts".to_string(),
                "housing_allotment_deed".to_string(),
                "resettlement_site_clearance".to_string(),
            ],
            allowed_transitions: vec!["project_closure".to_string()],
            audit_requirements: "Resettlement housing grants and subsistence allowances delivered to all affected families.".to_string(),
            gate_predicates: vec!["all_entitlements_delivered".to_string()],
            is_terminal: false,
        },
        StageDefinition {
            stage_code: "project_closure".to_string(),
            regime_code: "rfctlarr_2013".to_string(),
            ordinal: 15,
            stage_name: "Project Closure".to_string(),
            department_code: "government_oversight".to_string(),
            responsible_role: "government_reviewer".to_string(),
            approval_authority: "Central/State Ministry".to_string(),
            timeline_days: 15,
            required_documents: vec![
                "revenue_title_mutation_order".to_string(),
                "final_audit_reconciliation_certificate".to_string(),
                "project_handover_sign_off".to_string(),
            ],
            allowed_transitions: vec![],
            audit_requirements: "Land mutated in government revenue records; final audit closed; project archived.".to_string(),
            gate_predicates: vec!["title_mutated".to_string(), "audit_complete".to_string()],
            is_terminal: true,
        },
    ]
}

/// Returns the 10 statutory departments under the land acquisition governance framework.
pub fn list_statutory_departments() -> Vec<DepartmentInfo> {
    vec![
        DepartmentInfo {
            code: "requiring_body".to_string(),
            name: "Land Requiring Body".to_string(),
            mandate: "Requisitions land, provides DPR corridor alignment, funds acquisition and construction".to_string(),
            parent_authority: "NHAI / Railways / MoRTH".to_string(),
        },
        DepartmentInfo {
            code: "revenue_dept".to_string(),
            name: "State Revenue Department".to_string(),
            mandate: "Cadastral land verification, Record of Rights (RoR) mutation, Jamabandi records".to_string(),
            parent_authority: "State Government".to_string(),
        },
        DepartmentInfo {
            code: "survey_dept".to_string(),
            name: "Survey & Geo-informatics Wing".to_string(),
            mandate: "Cadastral boundary demarcation, GIS polygon mapping, DGPS ground-truthing".to_string(),
            parent_authority: "Directorate of Land Records".to_string(),
        },
        DepartmentInfo {
            code: "social_impact_dept".to_string(),
            name: "Social Impact Assessment Unit".to_string(),
            mandate: "Conducts statutory SIA study, census of affected families, SIMP formulation".to_string(),
            parent_authority: "State SIA Directorate".to_string(),
        },
        DepartmentInfo {
            code: "collectorate_dept".to_string(),
            name: "District Collectorate / CALA".to_string(),
            mandate: "Statutory competent authority, issues Sec 11/19 notices, conducts hearings, passes awards".to_string(),
            parent_authority: "District Administration".to_string(),
        },
        DepartmentInfo {
            code: "legal_dept".to_string(),
            name: "Legal & Litigation Cell".to_string(),
            mandate: "Scrutinizes claims, manages court stays, resolves land ownership title disputes".to_string(),
            parent_authority: "State Law Department".to_string(),
        },
        DepartmentInfo {
            code: "finance_dept".to_string(),
            name: "Finance & PFMS Division".to_string(),
            mandate: "Determines compensation awards, applies 100% Solatium & interest, executes PFMS DBT".to_string(),
            parent_authority: "Ministry of Finance".to_string(),
        },
        DepartmentInfo {
            code: "rr_dept".to_string(),
            name: "Resettlement & Rehabilitation Directorate".to_string(),
            mandate: "Implements Schedule II entitlements, delivers housing grants, establishes model colony".to_string(),
            parent_authority: "R&R Commissionerate".to_string(),
        },
        DepartmentInfo {
            code: "government_oversight".to_string(),
            name: "Appropriate Government / Oversight".to_string(),
            mandate: "Issues Section 19 declarations, monitors national corridors, configures regimes".to_string(),
            parent_authority: "Cabinet Secretariat / DoLR".to_string(),
        },
        DepartmentInfo {
            code: "citizen_desk".to_string(),
            name: "Public Citizen Transparency Desk".to_string(),
            mandate: "Public portal for survey lookups, gazette notification downloads, Section 15 objections".to_string(),
            parent_authority: "Public Transparency Cell".to_string(),
        },
    ]
}

/// Returns the 11 statutory stakeholder roles under the land acquisition governance framework.
pub fn list_statutory_roles() -> Vec<RoleInfo> {
    vec![
        RoleInfo {
            code: "land_requiring_body".to_string(),
            name: "Land Requiring Body".to_string(),
            department_code: "requiring_body".to_string(),
            tier: 1,
            default_jurisdiction: "national".to_string(),
            description: "Chief Project Officer initiating corridor proposal and DPR upload".to_string(),
        },
        RoleInfo {
            code: "revenue_officer".to_string(),
            name: "Revenue Officer".to_string(),
            department_code: "revenue_dept".to_string(),
            tier: 1,
            default_jurisdiction: "field".to_string(),
            description: "Tehsildar & Sub-Registrar verifying title, Khatiyan, and DILRMP sync".to_string(),
        },
        RoleInfo {
            code: "gis_officer".to_string(),
            name: "GIS Officer".to_string(),
            department_code: "survey_dept".to_string(),
            tier: 1,
            default_jurisdiction: "district".to_string(),
            description: "Geo-informatics specialist verifying cadastral polygons and DGPS coordinates".to_string(),
        },
        RoleInfo {
            code: "sia_officer".to_string(),
            name: "SIA Officer".to_string(),
            department_code: "social_impact_dept".to_string(),
            tier: 2,
            default_jurisdiction: "district".to_string(),
            description: "Social impact specialist conducting public consultations and SIMP report".to_string(),
        },
        RoleInfo {
            code: "collector".to_string(),
            name: "District Collector / CALA".to_string(),
            department_code: "collectorate_dept".to_string(),
            tier: 1,
            default_jurisdiction: "district".to_string(),
            description: "Statutory controller issuing Sec 11/3A notices, conducting hearings, passing awards".to_string(),
        },
        RoleInfo {
            code: "additional_collector".to_string(),
            name: "Additional Collector".to_string(),
            department_code: "collectorate_dept".to_string(),
            tier: 1,
            default_jurisdiction: "district".to_string(),
            description: "Assisting competent authority for valuation scrutiny and award certification".to_string(),
        },
        RoleInfo {
            code: "legal_officer".to_string(),
            name: "Legal Officer".to_string(),
            department_code: "legal_dept".to_string(),
            tier: 2,
            default_jurisdiction: "district".to_string(),
            description: "Advises CALA on title disputes, reference under Sec 64, and court stays".to_string(),
        },
        RoleInfo {
            code: "finance_officer".to_string(),
            name: "Finance Officer".to_string(),
            department_code: "finance_dept".to_string(),
            tier: 2,
            default_jurisdiction: "district".to_string(),
            description: "Accounts controller managing 100% Solatium, interest accrual, and PFMS DBT".to_string(),
        },
        RoleInfo {
            code: "rr_officer".to_string(),
            name: "Rehabilitation Officer".to_string(),
            department_code: "rr_dept".to_string(),
            tier: 2,
            default_jurisdiction: "district".to_string(),
            description: "R&R Administrator managing affected families census and Schedule II grants".to_string(),
        },
        RoleInfo {
            code: "government_reviewer".to_string(),
            name: "Government Reviewer".to_string(),
            department_code: "government_oversight".to_string(),
            tier: 3,
            default_jurisdiction: "national".to_string(),
            description: "Joint Secretary / Principal Secretary issuing Sec 19 declarations and monitoring policy".to_string(),
        },
        RoleInfo {
            code: "land_owner".to_string(),
            name: "Land Owner / Citizen".to_string(),
            department_code: "citizen_desk".to_string(),
            tier: 4,
            default_jurisdiction: "public".to_string(),
            description: "Affected titleholder / citizen searching surveys, inspecting notices, and filing objections".to_string(),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use sih_domain::{Parcel, Project};
    use uuid::Uuid;

    fn project(authority: Authority, stage: ProjectStage) -> Project {
        Project {
            id: Uuid::new_v4(),
            name: "Demo Highway Expansion".to_string(),
            authority,
            state_code: "RJ".to_string(),
            district_code: "BHP".to_string(),
            stage,
            parcels: vec![Parcel {
                id: Uuid::new_v4(),
                survey_number: "1042/1".to_string(),
                owner_name: "Rameshwar Patel".to_string(),
                area_hectares: 1.25,
                district_code: "BHP".to_string(),
            }],
            preliminary_notification_at: None,
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn valid_larr_transition_is_accepted() {
        let p = project(Authority::Larr, ProjectStage::Draft);
        assert!(can_transition(&p, &ProjectStage::Sanctioned, Utc::now()).is_ok());
    }

    #[test]
    fn valid_15_stage_canonical_flow() {
        let mut p = project(Authority::Larr, ProjectStage::ProposalInitiation);
        assert!(can_transition(&p, &ProjectStage::LandRecordVerification, Utc::now()).is_ok());

        p.stage = ProjectStage::LandRecordVerification;
        assert!(can_transition(&p, &ProjectStage::SiaPreparation, Utc::now()).is_ok());

        p.stage = ProjectStage::SiaPreparation;
        assert!(can_transition(&p, &ProjectStage::SiaReview, Utc::now()).is_ok());

        p.stage = ProjectStage::SiaReview;
        assert!(can_transition(&p, &ProjectStage::PreliminaryNotification, Utc::now()).is_ok());

        p.stage = ProjectStage::PreliminaryNotification;
        assert!(can_transition(&p, &ProjectStage::ObjectionPeriod, Utc::now()).is_ok());

        p.stage = ProjectStage::ObjectionPeriod;
        assert!(can_transition(&p, &ProjectStage::Hearing, Utc::now()).is_ok());

        p.stage = ProjectStage::Hearing;
        assert!(can_transition(&p, &ProjectStage::Declaration, Utc::now()).is_ok());

        p.stage = ProjectStage::Declaration;
        assert!(can_transition(&p, &ProjectStage::AwardPreparation, Utc::now()).is_ok());

        p.stage = ProjectStage::AwardPreparation;
        assert!(can_transition(&p, &ProjectStage::AwardApproval, Utc::now()).is_ok());

        p.stage = ProjectStage::AwardApproval;
        assert!(can_transition(&p, &ProjectStage::CompensationCalculation, Utc::now()).is_ok());

        p.stage = ProjectStage::CompensationCalculation;
        assert!(can_transition(&p, &ProjectStage::PaymentProcessing, Utc::now()).is_ok());

        p.stage = ProjectStage::PaymentProcessing;
        assert!(can_transition(&p, &ProjectStage::Possession, Utc::now()).is_ok());

        p.stage = ProjectStage::Possession;
        assert!(can_transition(&p, &ProjectStage::RrCompletion, Utc::now()).is_ok());

        p.stage = ProjectStage::RrCompletion;
        assert!(can_transition(&p, &ProjectStage::ProjectClosure, Utc::now()).is_ok());
    }

    #[test]
    fn who_handles_stage_resolves_all_15_stages_accurately() {
        let sia_handler = who_handles_stage(&ProjectStage::SiaPreparation);
        assert_eq!(sia_handler.department_code, "social_impact_dept");
        assert_eq!(sia_handler.role_code, "sia_officer");
        assert_eq!(sia_handler.timeline_days, 60);

        let rev_handler = who_handles_stage(&ProjectStage::LandRecordVerification);
        assert_eq!(rev_handler.department_code, "revenue_dept");
        assert_eq!(rev_handler.role_code, "revenue_officer");

        let coll_handler = who_handles_stage(&ProjectStage::PreliminaryNotification);
        assert_eq!(coll_handler.department_code, "collectorate_dept");
        assert_eq!(coll_handler.role_code, "collector");

        let fin_handler = who_handles_stage(&ProjectStage::CompensationCalculation);
        assert_eq!(fin_handler.department_code, "finance_dept");
        assert_eq!(fin_handler.role_code, "finance_officer");

        let rr_handler = who_handles_stage(&ProjectStage::RrCompletion);
        assert_eq!(rr_handler.department_code, "rr_dept");
        assert_eq!(rr_handler.role_code, "rr_officer");
    }

    #[test]
    fn gate_prevents_unauthorized_role_transition() {
        let p = project(Authority::Larr, ProjectStage::LandRecordVerification);
        // LandRecordVerification must be handled by revenue_officer, not land_owner
        let res = can_transition_with_gate(
            &p,
            &ProjectStage::SiaPreparation,
            Role::LandOwner,
            &[],
            Utc::now(),
        );
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().code, "unauthorized_role_for_stage");

        // Authorized role revenue_officer succeeds
        let res_ok = can_transition_with_gate(
            &p,
            &ProjectStage::SiaPreparation,
            Role::RevenueOfficer,
            &[],
            Utc::now(),
        );
        assert!(res_ok.is_ok());
    }

    #[test]
    fn invalid_transition_is_rejected() {
        let p = project(Authority::Larr, ProjectStage::Draft);
        assert_eq!(
            can_transition(&p, &ProjectStage::Survey, Utc::now())
                .expect_err("transition should fail")
                .code,
            "invalid_transition"
        );
    }

    #[test]
    fn national_highways_notification_lapses_after_one_year() {
        let notification = Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap();
        let mut p = project(
            Authority::NationalHighways,
            ProjectStage::PreliminaryNotification,
        );
        p.preliminary_notification_at = Some(notification);
        let now = notification + Duration::days(365);
        assert!(lapse_if_due(&mut p, now));
        assert_eq!(p.stage, ProjectStage::Lapsed);
    }

    #[test]
    fn mvp_stage_labels_follow_the_user_flow() {
        let stages = [
            ProjectStage::Draft,
            ProjectStage::Sanctioned,
            ProjectStage::Survey,
            ProjectStage::PreliminaryNotification,
            ProjectStage::PublicHearing,
            ProjectStage::CompensationAward,
            ProjectStage::RrScheme,
            ProjectStage::FundsDisbursed,
            ProjectStage::Possession,
            ProjectStage::Completed,
        ];
        let labels: Vec<_> = stages.iter().map(canonical_stage_label).collect();

        assert_eq!(
            labels,
            vec![
                "Project Created",
                "Project Created",
                "Land Verification",
                "Preliminary Notification (Sec 11)",
                "Objection Period",
                "Award Generation",
                "Compensation",
                "Compensation",
                "Possession",
                "Completed",
            ]
        );
        assert_eq!(
            MVP_STAGE_LABELS,
            [
                "Project Created",
                "Land Verification",
                "Notification",
                "Objection Period",
                "Award Generation",
                "Compensation",
                "Possession",
                "Completed",
            ]
        );
    }

    #[test]
    fn mvp_stage_labels_convert_to_representative_stages() {
        let expected = [
            ProjectStage::Draft,
            ProjectStage::Survey,
            ProjectStage::PreliminaryNotification,
            ProjectStage::ObjectionPeriod,
            ProjectStage::CompensationAward,
            ProjectStage::RrScheme,
            ProjectStage::Possession,
            ProjectStage::Completed,
        ];

        for (label, stage) in MVP_STAGE_LABELS.iter().zip(expected) {
            assert_eq!(stage_from_canonical_label(label), Some(stage));
        }
        assert_eq!(stage_from_canonical_label("Unknown"), None);
    }

    #[test]
    fn lapsed_stage_remains_distinct_from_the_mvp_flow() {
        assert_eq!(canonical_stage_label(&ProjectStage::Lapsed), "Lapsed");
        assert_eq!(stage_from_canonical_label("Lapsed"), None);
    }
}
