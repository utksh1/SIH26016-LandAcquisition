use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{error::Error, fmt};
use uuid::Uuid;

pub mod db;
pub mod repository;

pub type ProjectId = Uuid;
pub type ParcelId = Uuid;
pub type UserId = Uuid;
pub type OwnerId = Uuid;
pub type StakeholderId = Uuid;

/// The four roles supported by the MVP.
///
/// The serde-skipped compatibility variants preserve source compatibility with
/// the earlier prototype while keeping persisted/API role values limited to the
/// four MVP roles.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    Admin,
    LandRequiringBody,
    Collector,
    AdditionalCollector,
    RevenueOfficer,
    GisOfficer,
    SiaOfficer,
    LegalOfficer,
    FinanceOfficer,
    RrOfficer,
    GovernmentReviewer,
    LandOwner,
    // Source-compatibility variants for existing workflow/API crates
    #[serde(skip)]
    CentralMinistryOfficial,
    #[serde(skip)]
    StateRevenueDepartment,
    #[serde(skip)]
    DistrictCollector,
    #[serde(skip)]
    ProjectImplementingAgency,
    #[serde(skip)]
    FieldSurveyor,
    #[serde(skip)]
    RrAdministrator,
    #[serde(skip)]
    FinanceController,
    #[serde(skip)]
    PolicyMaker,
    #[serde(skip)]
    AuditOfficer,
    #[serde(skip)]
    CitizenSupportOfficer,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Admin
            | Self::CentralMinistryOfficial
            | Self::ProjectImplementingAgency
            | Self::PolicyMaker
            | Self::AuditOfficer => "admin",
            Self::LandRequiringBody => "land_requiring_body",
            Self::Collector
            | Self::DistrictCollector => "collector",
            Self::AdditionalCollector => "additional_collector",
            Self::RevenueOfficer
            | Self::StateRevenueDepartment
            | Self::FieldSurveyor => "revenue_officer",
            Self::GisOfficer => "gis_officer",
            Self::SiaOfficer => "sia_officer",
            Self::LegalOfficer => "legal_officer",
            Self::FinanceOfficer
            | Self::FinanceController => "finance_officer",
            Self::RrOfficer
            | Self::RrAdministrator => "rr_officer",
            Self::GovernmentReviewer => "government_reviewer",
            Self::LandOwner
            | Self::CitizenSupportOfficer => "land_owner",
        }
    }

    pub fn permissions(self) -> &'static [Permission] {
        match self {
            Self::Admin
            | Self::CentralMinistryOfficial
            | Self::ProjectImplementingAgency
            | Self::PolicyMaker
            | Self::AuditOfficer => &ALL_PERMISSIONS,
            Self::LandRequiringBody => &LAND_REQUIRING_BODY_PERMISSIONS,
            Self::Collector
            | Self::DistrictCollector => &COLLECTOR_PERMISSIONS,
            Self::AdditionalCollector => &ADDITIONAL_COLLECTOR_PERMISSIONS,
            Self::RevenueOfficer
            | Self::StateRevenueDepartment
            | Self::FieldSurveyor => &REVENUE_OFFICER_PERMISSIONS,
            Self::GisOfficer => &GIS_OFFICER_PERMISSIONS,
            Self::SiaOfficer => &SIA_OFFICER_PERMISSIONS,
            Self::LegalOfficer => &LEGAL_OFFICER_PERMISSIONS,
            Self::FinanceOfficer
            | Self::FinanceController => &FINANCE_OFFICER_PERMISSIONS,
            Self::RrOfficer
            | Self::RrAdministrator => &RR_OFFICER_PERMISSIONS,
            Self::GovernmentReviewer => &GOVERNMENT_REVIEWER_PERMISSIONS,
            Self::LandOwner
            | Self::CitizenSupportOfficer => &LAND_OWNER_PERMISSIONS,
        }
    }

    pub fn can(self, permission: Permission) -> bool {
        self.permissions().contains(&permission)
    }

    pub fn has_permission(self, permission: Permission) -> bool {
        self.can(permission)
    }
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Permissions used by the MVP RBAC boundary.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    ManageUsers,
    ManageRoles,
    ViewProjects,
    CreateProjects,
    UpdateProjects,
    TransitionProjects,
    ViewParcels,
    CreateParcels,
    UpdateParcels,
    ViewOwners,
    CreateOwners,
    UpdateOwners,
    ViewStakeholders,
    CreateStakeholders,
    UpdateStakeholders,
    ViewAudit,
    SubmitGrievances,
    // ---------------------------------------------------------------
    // RBAC Phase 2 additions — stage-specific action permissions used
    // by /me/tasks `allowed_actions` and the `authorize()` middleware
    // in services/api. Each maps to a concrete RFCTLARR Act 2013 action
    // surfaced as a button in the frontend "My Tasks" inbox.
    // ---------------------------------------------------------------
    /// Verify parcels / land records (LandRecordVerification, Survey).
    ParcelVerify,
    /// Reject / return a workflow to the previous stage.
    WorkflowReject,
    /// Create a Social Impact Assessment report (SiaPreparation).
    SiaCreate,
    /// Review a Social Impact Assessment report (SiaReview).
    SiaReview,
    /// Issue the preliminary notification under Section 11.
    NotificationIssue,
    /// Submit an objection during the objection period (Section 15).
    ObjectionSubmit,
    /// Review objections received during the objection period.
    ObjectionReview,
    /// Conduct a public hearing under Section 15B / 16.
    HearingConduct,
    /// Prepare the declaration under Section 19.
    DeclarationPrepare,
    /// Approve / sign the Section 19 declaration.
    DeclarationApprove,
    /// Prepare the compensation award under Section 23.
    AwardPrepare,
    /// Review the draft compensation award.
    AwardReview,
    /// Approve the final compensation award.
    AwardApprove,
    /// Calculate compensation solatium / interest (CompensationCalculation).
    CompensationCalculate,
    /// Initiate a payment via PFMS (PaymentProcessing).
    PaymentInitiate,
    /// Approve / release a payment (PaymentProcessing, FundsDisbursed).
    PaymentApprove,
    /// Initiate possession handover under Section 38 (Possession).
    PossessionInitiate,
    /// Manage R&R entitlements / family verification (RrCompletion, RrScheme).
    RrManage,
    /// View analytics dashboards / export reports (terminal stages).
    AnalyticsView,
    // ---------------------------------------------------------------
    // Phase 1 RBAC expansion (cont.): document gate, escrow deposits,
    // litigation, parcel geometry editing, national dashboard, and the
    // baseline dashboard permission granted to every authenticated role.
    // ---------------------------------------------------------------
    /// parcel.geometry.edit — GIS Officer edits parcel boundary geometry.
    ParcelGeometryEdit,
    /// document.upload — Any authenticated role may upload supporting docs.
    DocumentUpload,
    /// document.review — Legal Officer / Collector reviews uploaded doc.
    DocumentReview,
    /// document.approve — Collector approves document gate at stage transition.
    DocumentApprove,
    /// national.dashboard.view — Government Reviewer views national dashboard.
    NationalDashboardView,
    /// deposit.create — Legal Officer creates escrow deposit with authority.
    DepositCreate,
    /// deposit.release — Legal Officer releases escrow deposit to payee.
    DepositRelease,
    /// litigation.manage — Legal Officer records court stays / litigation status.
    LitigationManage,
    /// dashboard.view — Baseline dashboard access for all authenticated users.
    DashboardView,
}

#[allow(non_upper_case_globals)]
impl Permission {
    // Singular/read-write aliases make the permission vocabulary convenient for
    // API callers without creating duplicate serialized permissions.
    pub const ReadProjects: Self = Self::ViewProjects;
    pub const ReadParcels: Self = Self::ViewParcels;
    pub const ReadOwners: Self = Self::ViewOwners;
    pub const ReadStakeholders: Self = Self::ViewStakeholders;
    pub const CreateProject: Self = Self::CreateProjects;
    pub const UpdateProject: Self = Self::UpdateProjects;
    pub const CreateParcel: Self = Self::CreateParcels;
    pub const UpdateParcel: Self = Self::UpdateParcels;
    pub const CreateOwner: Self = Self::CreateOwners;
    pub const UpdateOwner: Self = Self::UpdateOwners;
    pub const CreateStakeholder: Self = Self::CreateStakeholders;
    pub const UpdateStakeholder: Self = Self::UpdateStakeholders;

    pub fn as_str(self) -> &'static str {
        match self {
            // === Legacy 17 variants (snake_case form, unchanged for backward compat) ===
            Self::ManageUsers => "manage_users",
            Self::ManageRoles => "manage_roles",
            Self::ViewProjects => "view_projects",
            Self::CreateProjects => "create_projects",
            Self::UpdateProjects => "update_projects",
            Self::TransitionProjects => "transition_projects",
            Self::ViewParcels => "view_parcels",
            Self::CreateParcels => "create_parcels",
            Self::UpdateParcels => "update_parcels",
            Self::ViewOwners => "view_owners",
            Self::CreateOwners => "create_owners",
            Self::UpdateOwners => "update_owners",
            Self::ViewStakeholders => "view_stakeholders",
            Self::CreateStakeholders => "create_stakeholders",
            Self::UpdateStakeholders => "update_stakeholders",
            Self::ViewAudit => "view_audit",
            Self::SubmitGrievances => "submit_grievances",
            // === Phase 1 RBAC expansion (28 granular, dotted notation per SIH26016 spec) ===
            Self::ParcelVerify => "parcel.verify",
            Self::ParcelGeometryEdit => "parcel.geometry.edit",
            Self::SiaCreate => "sia.create",
            Self::SiaReview => "sia.review",
            Self::NotificationIssue => "notification.issue",
            Self::ObjectionSubmit => "objection.submit",
            Self::ObjectionReview => "objection.review",
            Self::HearingConduct => "hearing.conduct",
            Self::DeclarationPrepare => "declaration.prepare",
            Self::DeclarationApprove => "declaration.approve",
            Self::AwardPrepare => "award.prepare",
            Self::AwardReview => "award.review",
            Self::AwardApprove => "award.approve",
            Self::CompensationCalculate => "compensation.calculate",
            Self::PaymentInitiate => "payment.initiate",
            Self::PaymentApprove => "payment.approve",
            Self::PossessionInitiate => "possession.initiate",
            Self::RrManage => "rr.manage",
            Self::DocumentUpload => "document.upload",
            Self::DocumentReview => "document.review",
            Self::DocumentApprove => "document.approve",
            Self::WorkflowReject => "workflow.reject",
            Self::AnalyticsView => "analytics.view",
            Self::NationalDashboardView => "national.dashboard.view",
            Self::DepositCreate => "deposit.create",
            Self::DepositRelease => "deposit.release",
            Self::LitigationManage => "litigation.manage",
            Self::DashboardView => "dashboard.view",
        }
    }

    /// Parse a permission from its canonical string representation.
    ///
    /// For legacy permissions this is the snake_case form returned by
    /// [`Permission::as_str`] (e.g. `"view_projects"`). For Phase 1 RBAC
    /// expansion permissions it is the dotted form (e.g. `"parcel.verify"`).
    ///
    /// The previous snake_case form of the Phase 2 additions (e.g.
    /// `"parcel_verify"`, `"workflow_reject"`) is *also* accepted for
    /// backward compatibility with any persisted permission strings, but
    /// `as_str()` now emits the canonical dotted form for new variants.
    ///
    /// Returns `None` for unrecognized strings so the `authorize()`
    /// middleware in services/api can fall through to a 403 cleanly.
    pub fn from_str(s: &str) -> Option<Self> {
        match s.trim() {
            // Legacy snake_case permissions
            "manage_users" => Some(Self::ManageUsers),
            "manage_roles" => Some(Self::ManageRoles),
            "view_projects" | "read_projects" => Some(Self::ViewProjects),
            "create_projects" | "create_project" => Some(Self::CreateProjects),
            "update_projects" | "update_project" => Some(Self::UpdateProjects),
            "transition_projects" => Some(Self::TransitionProjects),
            "view_parcels" | "read_parcels" => Some(Self::ViewParcels),
            "create_parcels" | "create_parcel" => Some(Self::CreateParcels),
            "update_parcels" | "update_parcel" => Some(Self::UpdateParcels),
            "view_owners" | "read_owners" => Some(Self::ViewOwners),
            "create_owners" | "create_owner" => Some(Self::CreateOwners),
            "update_owners" | "update_owner" => Some(Self::UpdateOwners),
            "view_stakeholders" | "read_stakeholders" => Some(Self::ViewStakeholders),
            "create_stakeholders" | "create_stakeholder" => Some(Self::CreateStakeholders),
            "update_stakeholders" | "update_stakeholder" => Some(Self::UpdateStakeholders),
            "view_audit" | "audit_read" | "audit.read" => Some(Self::ViewAudit),
            "submit_grievances" => Some(Self::SubmitGrievances),
            // Phase 1 RBAC expansion — canonical dotted form first, then
            // legacy snake_case alias for backward compatibility.
            "parcel.verify" | "parcel_verify" => Some(Self::ParcelVerify),
            "parcel.geometry.edit" | "parcel_geometry_edit" => Some(Self::ParcelGeometryEdit),
            "sia.create" | "sia_create" => Some(Self::SiaCreate),
            "sia.review" | "sia_review" => Some(Self::SiaReview),
            "notification.issue" | "notification_issue" => Some(Self::NotificationIssue),
            "objection.submit" | "objection_submit" => Some(Self::ObjectionSubmit),
            "objection.review" | "objection_review" => Some(Self::ObjectionReview),
            "hearing.conduct" | "hearing_conduct" => Some(Self::HearingConduct),
            "declaration.prepare" | "declaration_prepare" => Some(Self::DeclarationPrepare),
            "declaration.approve" | "declaration_approve" => Some(Self::DeclarationApprove),
            "award.prepare" | "award_prepare" => Some(Self::AwardPrepare),
            "award.review" | "award_review" => Some(Self::AwardReview),
            "award.approve" | "award_approve" => Some(Self::AwardApprove),
            "compensation.calculate" | "compensation_calculate" => {
                Some(Self::CompensationCalculate)
            }
            "payment.initiate" | "payment_initiate" => Some(Self::PaymentInitiate),
            "payment.approve" | "payment_approve" => Some(Self::PaymentApprove),
            "possession.initiate" | "possession_initiate" => Some(Self::PossessionInitiate),
            "rr.manage" | "rr_manage" => Some(Self::RrManage),
            "document.upload" | "document_upload" => Some(Self::DocumentUpload),
            "document.review" | "document_review" => Some(Self::DocumentReview),
            "document.approve" | "document_approve" => Some(Self::DocumentApprove),
            "workflow.reject" | "workflow_reject" => Some(Self::WorkflowReject),
            "analytics.view" | "analytics_view" => Some(Self::AnalyticsView),
            "national.dashboard.view" | "national_dashboard_view" => {
                Some(Self::NationalDashboardView)
            }
            "deposit.create" | "deposit_create" => Some(Self::DepositCreate),
            "deposit.release" | "deposit_release" => Some(Self::DepositRelease),
            "litigation.manage" | "litigation_manage" => Some(Self::LitigationManage),
            "dashboard.view" | "dashboard_view" => Some(Self::DashboardView),
            _ => None,
        }
    }

    /// All known permission variants in canonical order.
    ///
    /// Backs the `Admin` / `AuditOfficer` role mapping via `ALL_PERMISSIONS`
    /// and is also surfaced to admin UIs / DB seeding scripts that need to
    /// enumerate the full permission vocabulary.
    pub fn all() -> &'static [Permission] {
        &ALL_PERMISSIONS
    }
}

impl fmt::Display for Permission {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

// 17 legacy + 28 Phase 1 RBAC expansion = 45 total permissions.
// The order is: legacy snake_case permissions first, then the granular
// dotted-form permissions grouped by domain. Order matters only for
// human readability — `Role::permissions()` references variants directly.
const ALL_PERMISSIONS: [Permission; 45] = [
    // Legacy 17
    Permission::ManageUsers,
    Permission::ManageRoles,
    Permission::ViewProjects,
    Permission::CreateProjects,
    Permission::UpdateProjects,
    Permission::TransitionProjects,
    Permission::ViewParcels,
    Permission::CreateParcels,
    Permission::UpdateParcels,
    Permission::ViewOwners,
    Permission::CreateOwners,
    Permission::UpdateOwners,
    Permission::ViewStakeholders,
    Permission::CreateStakeholders,
    Permission::UpdateStakeholders,
    Permission::ViewAudit,
    Permission::SubmitGrievances,
    // Phase 1 RBAC expansion (28 granular permissions)
    Permission::ParcelVerify,
    Permission::ParcelGeometryEdit,
    Permission::SiaCreate,
    Permission::SiaReview,
    Permission::NotificationIssue,
    Permission::ObjectionSubmit,
    Permission::ObjectionReview,
    Permission::HearingConduct,
    Permission::DeclarationPrepare,
    Permission::DeclarationApprove,
    Permission::AwardPrepare,
    Permission::AwardReview,
    Permission::AwardApprove,
    Permission::CompensationCalculate,
    Permission::PaymentInitiate,
    Permission::PaymentApprove,
    Permission::PossessionInitiate,
    Permission::RrManage,
    Permission::DocumentUpload,
    Permission::DocumentReview,
    Permission::DocumentApprove,
    Permission::WorkflowReject,
    Permission::AnalyticsView,
    Permission::NationalDashboardView,
    Permission::DepositCreate,
    Permission::DepositRelease,
    Permission::LitigationManage,
    Permission::DashboardView,
];

// Collector: 20 perms — owns the high-stakes approval gates across the
// Collector: owns the high-stakes approval gates across the
// RFCTLARR workflow (Section 11 notification, hearing, award approval,
// solatium calculation, possession, document gate, and stage rejection).
const COLLECTOR_PERMISSIONS: [Permission; 27] = [
    Permission::DashboardView,
    Permission::ViewProjects,
    Permission::CreateProjects,
    Permission::UpdateProjects,
    Permission::TransitionProjects,
    Permission::ViewParcels,
    Permission::CreateParcels,
    Permission::UpdateParcels,
    Permission::ViewOwners,
    Permission::CreateOwners,
    Permission::UpdateOwners,
    Permission::ViewStakeholders,
    Permission::ParcelVerify,
    Permission::NotificationIssue,
    Permission::ObjectionReview,
    Permission::HearingConduct,
    Permission::AwardPrepare,
    Permission::AwardReview,
    Permission::AwardApprove,
    Permission::CompensationCalculate,
    Permission::PossessionInitiate,
    Permission::DocumentApprove,
    Permission::WorkflowReject,
    Permission::DepositCreate,
    Permission::LitigationManage,
    Permission::SiaReview,
    Permission::ViewAudit,
];

// Revenue Officer: 10 perms — parcel record verification, RoR extracts, possession panchnama assistance.
const REVENUE_OFFICER_PERMISSIONS: [Permission; 10] = [
    Permission::DashboardView,
    Permission::ViewProjects,
    Permission::ViewParcels,
    Permission::CreateParcels,
    Permission::UpdateParcels,
    Permission::ViewOwners,
    Permission::ParcelVerify,
    Permission::DocumentUpload,
    Permission::PossessionInitiate,
    Permission::TransitionProjects,
];

const LAND_REQUIRING_BODY_PERMISSIONS: [Permission; 10] = [
    Permission::DashboardView,
    Permission::ViewProjects,
    Permission::CreateProjects,
    Permission::UpdateProjects,
    Permission::ViewParcels,
    Permission::CreateParcels,
    Permission::ViewStakeholders,
    Permission::DocumentUpload,
    Permission::TransitionProjects,
    Permission::AnalyticsView,
];

// Additional Collector: 16 perms — drafts declarations, reviews awards,
// objections and documents.
const ADDITIONAL_COLLECTOR_PERMISSIONS: [Permission; 16] = [
    Permission::DashboardView,
    Permission::ViewProjects,
    Permission::UpdateProjects,
    Permission::TransitionProjects,
    Permission::ViewParcels,
    Permission::ViewOwners,
    Permission::ParcelVerify,
    Permission::DeclarationPrepare,
    Permission::ObjectionReview,
    Permission::HearingConduct,
    Permission::AwardReview,
    Permission::CompensationCalculate,
    Permission::DepositCreate,
    Permission::LitigationManage,
    Permission::DocumentReview,
    Permission::ViewAudit,
];

const GIS_OFFICER_PERMISSIONS: [Permission; 7] = [
    Permission::DashboardView,
    Permission::ViewProjects,
    Permission::ViewParcels,
    Permission::CreateParcels,
    Permission::UpdateParcels,
    Permission::ParcelGeometryEdit,
    Permission::DocumentUpload,
];

const SIA_OFFICER_PERMISSIONS: [Permission; 10] = [
    Permission::DashboardView,
    Permission::ViewProjects,
    Permission::UpdateProjects,
    Permission::ViewParcels,
    Permission::ViewOwners,
    Permission::SiaCreate,
    Permission::SiaReview,
    Permission::HearingConduct,
    Permission::DocumentUpload,
    Permission::TransitionProjects,
];

// Legal Officer: 13 perms — award preparation/review, escrow deposits,
// litigation tracking, document review.
const LEGAL_OFFICER_PERMISSIONS: [Permission; 13] = [
    Permission::DashboardView,
    Permission::ViewProjects,
    Permission::ViewParcels,
    Permission::ViewOwners,
    Permission::ViewStakeholders,
    Permission::AwardPrepare,
    Permission::AwardReview,
    Permission::DepositCreate,
    Permission::DepositRelease,
    Permission::LitigationManage,
    Permission::DocumentReview,
    Permission::ViewAudit,
    Permission::SubmitGrievances,
];

// Finance Officer: 13 perms — compensation review, PFMS payment flow, deposits, analytics.
const FINANCE_OFFICER_PERMISSIONS: [Permission; 13] = [
    Permission::DashboardView,
    Permission::ViewProjects,
    Permission::UpdateProjects,
    Permission::ViewParcels,
    Permission::ViewOwners,
    Permission::CompensationCalculate,
    Permission::AwardReview,
    Permission::PaymentInitiate,
    Permission::PaymentApprove,
    Permission::DepositCreate,
    Permission::AnalyticsView,
    Permission::TransitionProjects,
    Permission::DocumentUpload,
];

// R&R Officer: 10 perms — manages resettlement & rehabilitation entitlements, SIMP review, grievances.
const RR_OFFICER_PERMISSIONS: [Permission; 10] = [
    Permission::DashboardView,
    Permission::ViewProjects,
    Permission::ViewParcels,
    Permission::ViewOwners,
    Permission::RrManage,
    Permission::SiaReview,
    Permission::SubmitGrievances,
    Permission::AnalyticsView,
    Permission::DocumentUpload,
    Permission::TransitionProjects,
];

// Government Reviewer: 13 perms — oversight over SIA, declarations,
// analytics, and the national dashboard.
const GOVERNMENT_REVIEWER_PERMISSIONS: [Permission; 13] = [
    Permission::DashboardView,
    Permission::ViewProjects,
    Permission::CreateProjects,
    Permission::UpdateProjects,
    Permission::TransitionProjects,
    Permission::ViewParcels,
    Permission::ViewOwners,
    Permission::ViewStakeholders,
    Permission::ViewAudit,
    Permission::AnalyticsView,
    Permission::NationalDashboardView,
    Permission::SiaReview,
    Permission::DeclarationApprove,
];

const LAND_OWNER_PERMISSIONS: [Permission; 7] = [
    Permission::DashboardView,
    Permission::ViewProjects,
    Permission::ViewParcels,
    Permission::ViewOwners,
    Permission::ObjectionSubmit,
    Permission::DocumentUpload,
    Permission::SubmitGrievances,
];

/// Scope used for role and resource authorization. The code-bearing variants
/// keep state/district boundaries explicit while preserving the API's actor
/// representation.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Jurisdiction {
    National,
    State { code: String },
    District { code: String },
    Field { district_code: String },
    Public,
}

impl Jurisdiction {
    pub fn national() -> Self {
        Self::National
    }

    pub fn state(code: impl Into<String>) -> Self {
        Self::State { code: code.into() }
    }

    pub fn district(code: impl Into<String>) -> Self {
        Self::District { code: code.into() }
    }

    pub fn public() -> Self {
        Self::Public
    }

    pub fn is_public(&self) -> bool {
        matches!(self, Self::Public)
    }
}

pub type ActorJurisdiction = Jurisdiction;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Actor {
    pub id: Uuid,
    pub role: Role,
    pub jurisdiction: Jurisdiction,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct User {
    pub id: UserId,
    pub name: String,
    pub email: String,
    pub role: Role,
    pub jurisdiction: Jurisdiction,
    pub active: bool,
}

impl User {
    pub fn new(
        name: impl Into<String>,
        email: impl Into<String>,
        role: Role,
        jurisdiction: Jurisdiction,
    ) -> Result<Self, ValidationError> {
        let user = Self {
            id: Uuid::new_v4(),
            name: name.into(),
            email: email.into(),
            role,
            jurisdiction,
            active: true,
        };
        user.validate()?;
        Ok(user)
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_id(self.id, "user.id")?;
        validate_text(&self.name, "user.name", 200)?;
        let email = self.email.trim();
        if email.is_empty() || email.chars().filter(|character| *character == '@').count() != 1 {
            return Err(ValidationError::Invalid {
                field: "user.email",
                message: "must contain one @ and a non-empty local/domain part".to_string(),
            });
        }
        let (local, domain) = email.split_once('@').expect("count checked above");
        if local.is_empty() || domain.is_empty() || !domain.contains('.') {
            return Err(ValidationError::Invalid {
                field: "user.email",
                message: "must contain a valid local and domain part".to_string(),
            });
        }
        Ok(())
    }

    pub fn actor(&self) -> Actor {
        Actor {
            id: self.id,
            role: self.role,
            jurisdiction: self.jurisdiction.clone(),
        }
    }
}

impl Actor {
    pub fn from_user(user: &User) -> Self {
        user.actor()
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Authority {
    Larr,
    NationalHighways,
}

/// Persisted project status. `ProjectStage` is retained as the API/workflow
/// spelling; `ProjectStatus` is the domain spelling used by new callers.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ProjectStage {
    // 15 Canonical Legal Stages under RFCTLARR Act 2013
    ProposalInitiation,
    LandRecordVerification,
    SiaPreparation,
    SiaReview,
    PreliminaryNotification,
    ObjectionPeriod,
    Hearing,
    Declaration,
    AwardPreparation,
    AwardApproval,
    CompensationCalculation,
    PaymentProcessing,
    Possession,
    RrCompletion,
    ProjectClosure,

    // Legacy variants for backward compatibility
    Draft,
    Sanctioned,
    PublicHearing,
    Survey,
    CompensationAward,
    RrScheme,
    FundsDisbursed,
    Completed,
    Lapsed,
}

pub type ProjectStatus = ProjectStage;

impl Default for ProjectStage {
    fn default() -> Self {
        Self::Draft
    }
}

impl ProjectStage {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ProposalInitiation | Self::Draft => "proposal_initiation",
            Self::Sanctioned => "sanctioned",
            Self::LandRecordVerification | Self::Survey => "land_record_verification",
            Self::SiaPreparation => "sia_preparation",
            Self::SiaReview => "sia_review",
            Self::PreliminaryNotification => "preliminary_notification",
            Self::ObjectionPeriod | Self::PublicHearing => "objection_period",
            Self::Hearing => "hearing",
            Self::Declaration => "declaration",
            Self::AwardPreparation => "award_preparation",
            Self::AwardApproval | Self::CompensationAward => "award_approval",
            Self::CompensationCalculation => "compensation_calculation",
            Self::PaymentProcessing | Self::FundsDisbursed => "payment_processing",
            Self::Possession => "possession",
            Self::RrCompletion | Self::RrScheme => "rr_completion",
            Self::ProjectClosure | Self::Completed => "project_closure",
            Self::Lapsed => "lapsed",
        }
    }

    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            Self::ProjectClosure | Self::Completed | Self::Lapsed
        )
    }
}

impl fmt::Display for ProjectStage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str((*self).as_str())
    }
}

/// Statutory RFCTLARR Stage Specification
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct StageDefinition {
    pub stage_code: String,
    pub regime_code: String,
    pub ordinal: u32,
    pub stage_name: String,
    pub department_code: String,
    pub responsible_role: String,
    pub approval_authority: String,
    pub timeline_days: u32,
    pub required_documents: Vec<String>,
    pub allowed_transitions: Vec<String>,
    pub audit_requirements: String,
    pub gate_predicates: Vec<String>,
    pub is_terminal: bool,
}

/// Statutory Department Definition
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct DepartmentInfo {
    pub code: String,
    pub name: String,
    pub mandate: String,
    pub parent_authority: String,
}

/// Statutory Stakeholder Role Definition
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct RoleInfo {
    pub code: String,
    pub name: String,
    pub department_code: String,
    pub tier: u8,
    pub default_jurisdiction: String,
    pub description: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Parcel {
    pub id: ParcelId,
    pub survey_number: String,
    pub owner_name: String,
    pub area_hectares: f64,
    pub district_code: String,
}

impl Parcel {
    pub fn new(
        survey_number: impl Into<String>,
        owner_name: impl Into<String>,
        area_hectares: f64,
        district_code: impl Into<String>,
    ) -> Result<Self, ValidationError> {
        let parcel = Self {
            id: Uuid::new_v4(),
            survey_number: survey_number.into(),
            owner_name: owner_name.into(),
            area_hectares,
            district_code: district_code.into(),
        };
        parcel.validate()?;
        Ok(parcel)
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_id(self.id, "parcel.id")?;
        validate_text(&self.survey_number, "parcel.survey_number", 128)?;
        validate_text(&self.owner_name, "parcel.owner_name", 200)?;
        if !self.area_hectares.is_finite() || self.area_hectares <= 0.0 {
            return Err(ValidationError::Invalid {
                field: "parcel.area_hectares",
                message: "must be a finite value greater than zero".to_string(),
            });
        }
        validate_code(&self.district_code, "parcel.district_code", 2, 64)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Owner {
    pub id: OwnerId,
    pub name: String,
    pub contact: Option<String>,
    pub address: Option<String>,
}

impl Owner {
    pub fn new(name: impl Into<String>) -> Result<Self, ValidationError> {
        let owner = Self {
            id: Uuid::new_v4(),
            name: name.into(),
            contact: None,
            address: None,
        };
        owner.validate()?;
        Ok(owner)
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_id(self.id, "owner.id")?;
        validate_text(&self.name, "owner.name", 200)?;
        validate_optional_text(&self.contact, "owner.contact", 100)?;
        validate_optional_text(&self.address, "owner.address", 500)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Stakeholder {
    pub id: StakeholderId,
    pub project_id: ProjectId,
    pub name: String,
    pub role: Role,
    pub contact: Option<String>,
}

impl Stakeholder {
    pub fn new(
        project_id: ProjectId,
        name: impl Into<String>,
        role: Role,
    ) -> Result<Self, ValidationError> {
        let stakeholder = Self {
            id: Uuid::new_v4(),
            project_id,
            name: name.into(),
            role,
            contact: None,
        };
        stakeholder.validate()?;
        Ok(stakeholder)
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_id(self.id, "stakeholder.id")?;
        validate_id(self.project_id, "stakeholder.project_id")?;
        validate_text(&self.name, "stakeholder.name", 200)?;
        validate_optional_text(&self.contact, "stakeholder.contact", 100)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Project {
    pub id: ProjectId,
    pub name: String,
    pub authority: Authority,
    pub state_code: String,
    pub district_code: String,
    pub stage: ProjectStage,
    pub parcels: Vec<Parcel>,
    pub preliminary_notification_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

impl Project {
    pub fn new(
        name: impl Into<String>,
        authority: Authority,
        state_code: impl Into<String>,
        district_code: impl Into<String>,
    ) -> Result<Self, ValidationError> {
        let project = Self {
            id: Uuid::new_v4(),
            name: name.into(),
            authority,
            state_code: state_code.into(),
            district_code: district_code.into(),
            stage: ProjectStage::Draft,
            parcels: Vec::new(),
            preliminary_notification_at: None,
            updated_at: Utc::now(),
        };
        project.validate()?;
        Ok(project)
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_id(self.id, "project.id")?;
        validate_text_range(&self.name, "project.name", 3, 200)?;
        validate_code(&self.state_code, "project.state_code", 2, 32)?;
        validate_code(&self.district_code, "project.district_code", 2, 64)?;
        if let Some(notification_at) = self.preliminary_notification_at {
            if notification_at > self.updated_at {
                return Err(ValidationError::Invalid {
                    field: "project.preliminary_notification_at",
                    message: "cannot be later than updated_at".to_string(),
                });
            }
        }

        let mut parcel_ids = std::collections::HashSet::with_capacity(self.parcels.len());
        let mut survey_numbers = std::collections::HashSet::with_capacity(self.parcels.len());
        for parcel in &self.parcels {
            parcel.validate()?;
            if parcel.district_code.trim() != self.district_code.trim() {
                return Err(ValidationError::Mismatch {
                    field: "parcel.district_code",
                    expected: self.district_code.clone(),
                    actual: parcel.district_code.clone(),
                });
            }
            if !parcel_ids.insert(parcel.id) {
                return Err(ValidationError::Duplicate {
                    field: "parcel.id",
                    value: parcel.id.to_string(),
                });
            }
            if !survey_numbers.insert(parcel.survey_number.trim().to_string()) {
                return Err(ValidationError::Duplicate {
                    field: "parcel.survey_number",
                    value: parcel.survey_number.clone(),
                });
            }
        }
        Ok(())
    }

    pub fn status(&self) -> ProjectStatus {
        self.stage
    }

    pub fn parcel_count(&self) -> usize {
        self.parcels.len()
    }

    pub fn total_area_hectares(&self) -> f64 {
        self.parcels.iter().map(|parcel| parcel.area_hectares).sum()
    }

    pub fn summary(&self) -> ProjectSummary {
        ProjectSummary::from(self)
    }

    pub fn detail(&self) -> ProjectDetail {
        ProjectDetail::from(self)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ProjectSummary {
    pub id: ProjectId,
    pub name: String,
    pub authority: Authority,
    pub state_code: String,
    pub district_code: String,
    pub status: ProjectStatus,
    pub parcel_count: usize,
    pub total_area_hectares: f64,
    pub updated_at: DateTime<Utc>,
}

impl From<&Project> for ProjectSummary {
    fn from(project: &Project) -> Self {
        Self {
            id: project.id,
            name: project.name.clone(),
            authority: project.authority,
            state_code: project.state_code.clone(),
            district_code: project.district_code.clone(),
            status: project.status(),
            parcel_count: project.parcel_count(),
            total_area_hectares: project.total_area_hectares(),
            updated_at: project.updated_at,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ProjectDetail {
    #[serde(flatten)]
    pub project: Project,
    pub parcel_count: usize,
    pub total_area_hectares: f64,
}

impl From<&Project> for ProjectDetail {
    fn from(project: &Project) -> Self {
        Self {
            project: project.clone(),
            parcel_count: project.parcel_count(),
            total_area_hectares: project.total_area_hectares(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum ValidationError {
    Required {
        field: &'static str,
    },
    Invalid {
        field: &'static str,
        message: String,
    },
    Mismatch {
        field: &'static str,
        expected: String,
        actual: String,
    },
    Duplicate {
        field: &'static str,
        value: String,
    },
}

impl fmt::Display for ValidationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Required { field } => write!(f, "{field} is required"),
            Self::Invalid { field, message } => write!(f, "{field} is invalid: {message}"),
            Self::Mismatch {
                field,
                expected,
                actual,
            } => write!(f, "{field} must match {expected}, got {actual}"),
            Self::Duplicate { field, value } => write!(f, "duplicate {field}: {value}"),
        }
    }
}

impl Error for ValidationError {}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RepositoryError {
    Validation(ValidationError),
    AlreadyExists { resource: &'static str, id: Uuid },
}

impl fmt::Display for RepositoryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Validation(error) => error.fmt(f),
            Self::AlreadyExists { resource, id } => write!(f, "{resource} {id} already exists"),
        }
    }
}

impl Error for RepositoryError {}

impl From<ValidationError> for RepositoryError {
    fn from(error: ValidationError) -> Self {
        Self::Validation(error)
    }
}

fn validate_id(id: Uuid, field: &'static str) -> Result<(), ValidationError> {
    if id.is_nil() {
        return Err(ValidationError::Invalid {
            field,
            message: "must not be nil".to_string(),
        });
    }
    Ok(())
}

fn validate_text(
    value: &str,
    field: &'static str,
    max_chars: usize,
) -> Result<(), ValidationError> {
    validate_text_range(value, field, 1, max_chars)
}

fn validate_text_range(
    value: &str,
    field: &'static str,
    min_chars: usize,
    max_chars: usize,
) -> Result<(), ValidationError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(ValidationError::Required { field });
    }
    let length = trimmed.chars().count();
    if length < min_chars || length > max_chars {
        return Err(ValidationError::Invalid {
            field,
            message: format!("must be between {min_chars} and {max_chars} characters"),
        });
    }
    Ok(())
}

fn validate_optional_text(
    value: &Option<String>,
    field: &'static str,
    max_chars: usize,
) -> Result<(), ValidationError> {
    if let Some(value) = value {
        if value.trim().is_empty() {
            return Err(ValidationError::Invalid {
                field,
                message: "must not be blank when supplied".to_string(),
            });
        }
        if value.chars().count() > max_chars {
            return Err(ValidationError::Invalid {
                field,
                message: format!("must be at most {max_chars} characters"),
            });
        }
    }
    Ok(())
}

fn validate_code(
    value: &str,
    field: &'static str,
    min_chars: usize,
    max_chars: usize,
) -> Result<(), ValidationError> {
    validate_text_range(value, field, min_chars, max_chars)?;
    if !value
        .trim()
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return Err(ValidationError::Invalid {
            field,
            message: "may contain only letters, numbers, '-' or '_'".to_string(),
        });
    }
    Ok(())
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct AuditEntry {
    pub sequence: u64,
    pub timestamp: DateTime<Utc>,
    pub actor_id: Uuid,
    pub action: String,
    pub resource: String,
    pub payload: serde_json::Value,
    pub previous_hash: String,
    pub hash: String,
}

impl AuditEntry {
    pub fn new(
        sequence: u64,
        actor_id: Uuid,
        action: impl Into<String>,
        resource: impl Into<String>,
        payload: serde_json::Value,
        previous_hash: impl Into<String>,
    ) -> Self {
        let timestamp = Utc::now();
        let action = action.into();
        let resource = resource.into();
        let previous_hash = previous_hash.into();
        let canonical = format!(
            "{}|{}|{}|{}|{}|{}|{}",
            sequence,
            timestamp.to_rfc3339(),
            actor_id,
            action,
            resource,
            payload,
            previous_hash
        );
        let hash = format!("{:x}", Sha256::digest(canonical.as_bytes()));
        Self {
            sequence,
            timestamp,
            actor_id,
            action,
            resource,
            payload,
            previous_hash,
            hash,
        }
    }
}

pub fn verify_audit_chain(entries: &[AuditEntry]) -> bool {
    let mut previous = String::new();
    let mut expected_sequence = 1;
    for entry in entries {
        if entry.sequence != expected_sequence || entry.previous_hash != previous {
            return false;
        }
        let canonical = format!(
            "{}|{}|{}|{}|{}|{}|{}",
            entry.sequence,
            entry.timestamp.to_rfc3339(),
            entry.actor_id,
            entry.action,
            entry.resource,
            entry.payload,
            entry.previous_hash
        );
        let expected = format!("{:x}", Sha256::digest(canonical.as_bytes()));
        if entry.hash != expected {
            return false;
        }
        previous = entry.hash.clone();
        expected_sequence += 1;
    }
    true
}

/// Synchronous repository seam retained for the current Axum API and jobs.
/// Implementations only need to provide these three original operations; the
/// checked/default operations below add validation without breaking adapters.
pub trait ProjectRepository: Send + Sync {
    fn list_projects(&self) -> Vec<Project>;
    fn get_project(&self, id: ProjectId) -> Option<Project>;
    fn save_project(&self, project: Project);

    fn create_project(&self, project: Project) -> Result<Project, RepositoryError> {
        project.validate()?;
        if self.get_project(project.id).is_some() {
            return Err(RepositoryError::AlreadyExists {
                resource: "project",
                id: project.id,
            });
        }
        self.save_project(project.clone());
        Ok(project)
    }

    fn save_project_checked(&self, project: Project) -> Result<(), ValidationError> {
        project.validate()?;
        self.save_project(project);
        Ok(())
    }

    fn list_project_summaries(&self) -> Vec<ProjectSummary> {
        self.list_projects()
            .iter()
            .map(ProjectSummary::from)
            .collect()
    }

    fn get_project_detail(&self, id: ProjectId) -> Option<ProjectDetail> {
        self.get_project(id).map(|project| project.detail())
    }
}

pub trait UserRepository: Send + Sync {
    fn list_users(&self) -> Vec<User>;
    fn get_user(&self, id: UserId) -> Option<User>;
    fn save_user(&self, user: User);

    fn save_user_checked(&self, user: User) -> Result<(), ValidationError> {
        user.validate()?;
        self.save_user(user);
        Ok(())
    }
}

pub trait ParcelRepository: Send + Sync {
    fn list_parcels(&self, project_id: ProjectId) -> Vec<Parcel>;
    fn get_parcel(&self, id: ParcelId) -> Option<Parcel>;
    fn save_parcel(&self, project_id: ProjectId, parcel: Parcel);

    fn save_parcel_checked(
        &self,
        project_id: ProjectId,
        parcel: Parcel,
    ) -> Result<(), ValidationError> {
        validate_id(project_id, "project.id")?;
        parcel.validate()?;
        self.save_parcel(project_id, parcel);
        Ok(())
    }
}

pub trait OwnerRepository: Send + Sync {
    fn list_owners(&self) -> Vec<Owner>;
    fn get_owner(&self, id: OwnerId) -> Option<Owner>;
    fn save_owner(&self, owner: Owner);

    fn save_owner_checked(&self, owner: Owner) -> Result<(), ValidationError> {
        owner.validate()?;
        self.save_owner(owner);
        Ok(())
    }
}

pub trait StakeholderRepository: Send + Sync {
    fn list_stakeholders(&self, project_id: ProjectId) -> Vec<Stakeholder>;
    fn get_stakeholder(&self, id: StakeholderId) -> Option<Stakeholder>;
    fn save_stakeholder(&self, stakeholder: Stakeholder);

    fn save_stakeholder_checked(&self, stakeholder: Stakeholder) -> Result<(), ValidationError> {
        stakeholder.validate()?;
        self.save_stakeholder(stakeholder);
        Ok(())
    }
}

pub trait AuditRepository: Send + Sync {
    fn append_audit(&self, entry: AuditEntry);
    fn list_audit(&self) -> Vec<AuditEntry>;
}

// Async repository traits for PostgreSQL
#[async_trait::async_trait]
pub trait AsyncProjectRepository: Send + Sync {
    async fn list_projects(&self) -> Result<Vec<Project>, Box<dyn Error + Send + Sync>>;
    async fn get_project(&self, id: ProjectId) -> Result<Option<Project>, Box<dyn Error + Send + Sync>>;
    async fn save_project(&self, project: &Project) -> Result<(), Box<dyn Error + Send + Sync>>;
}

#[async_trait::async_trait]
pub trait AsyncParcelRepository: Send + Sync {
    async fn list_parcels(&self, project_id: ProjectId) -> Result<Vec<Parcel>, Box<dyn Error + Send + Sync>>;
    async fn get_parcel(&self, id: ParcelId) -> Result<Option<Parcel>, Box<dyn Error + Send + Sync>>;
    async fn save_parcel(&self, project_id: ProjectId, parcel: &Parcel) -> Result<(), Box<dyn Error + Send + Sync>>;
}

#[async_trait::async_trait]
pub trait AsyncUserRepository: Send + Sync {
    async fn list_users(&self) -> Result<Vec<User>, Box<dyn Error + Send + Sync>>;
    async fn get_user(&self, id: UserId) -> Result<Option<User>, Box<dyn Error + Send + Sync>>;
    async fn save_user(&self, user: &User) -> Result<(), Box<dyn Error + Send + Sync>>;
}

#[async_trait::async_trait]
pub trait AsyncOwnerRepository: Send + Sync {
    async fn list_owners(&self) -> Result<Vec<Owner>, Box<dyn Error + Send + Sync>>;
    async fn get_owner(&self, id: OwnerId) -> Result<Option<Owner>, Box<dyn Error + Send + Sync>>;
    async fn save_owner(&self, owner: &Owner) -> Result<(), Box<dyn Error + Send + Sync>>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, sync::RwLock};

    fn valid_parcel() -> Parcel {
        Parcel::new("1042", "Asha Devi", 1.25, "BLR").expect("valid parcel")
    }

    fn valid_project() -> Project {
        let mut project =
            Project::new("NH-48 Package II", Authority::NationalHighways, "KA", "BLR")
                .expect("valid project");
        project.parcels.push(valid_parcel());
        project.validate().expect("project with valid parcel");
        project
    }

    #[test]
    fn roles_are_limited_to_mvp_and_permissions_are_role_scoped() {
        assert_eq!(serde_json::to_string(&Role::Admin).unwrap(), "\"admin\"");
        assert!(Role::Admin.can(Permission::ManageUsers));
        assert!(Role::Collector.can(Permission::UpdateParcels));
        assert!(Role::RevenueOfficer.can(Permission::ViewOwners));
        assert!(Role::LandOwner.can(Permission::SubmitGrievances));
        assert!(!Role::LandOwner.can(Permission::ManageUsers));
    }

    #[test]
    fn phase2_stage_action_permissions_round_trip_and_are_role_scoped() {
        // as_str ↔ from_str round-trip for every Phase 2 permission.
        let phase2 = [
            Permission::ParcelVerify,
            Permission::WorkflowReject,
            Permission::SiaCreate,
            Permission::SiaReview,
            Permission::NotificationIssue,
            Permission::ObjectionSubmit,
            Permission::ObjectionReview,
            Permission::HearingConduct,
            Permission::DeclarationPrepare,
            Permission::DeclarationApprove,
            Permission::AwardPrepare,
            Permission::AwardReview,
            Permission::AwardApprove,
            Permission::CompensationCalculate,
            Permission::PaymentInitiate,
            Permission::PaymentApprove,
            Permission::PossessionInitiate,
            Permission::RrManage,
            Permission::AnalyticsView,
        ];
        for p in phase2 {
            let s = p.as_str();
            assert_eq!(Permission::from_str(s), Some(p), "round-trip failed for {s}");
        }

        // Role scoping: Admin has every Phase 2 permission; LandOwner
        // only has ObjectionSubmit (the rest must be denied).
        for p in phase2 {
            assert!(Role::Admin.can(p), "Admin should have {}", p.as_str());
        }
        assert!(Role::LandOwner.can(Permission::ObjectionSubmit));
        assert!(!Role::LandOwner.can(Permission::SiaCreate));
        assert!(!Role::LandOwner.can(Permission::PaymentApprove));

        // SIA-specific permissions land on the SiaOfficer.
        assert!(Role::SiaOfficer.can(Permission::SiaCreate));
        assert!(Role::SiaOfficer.can(Permission::SiaReview));
        // Finance-specific permissions land on the FinanceOfficer.
        assert!(Role::FinanceOfficer.can(Permission::PaymentInitiate));
        assert!(Role::FinanceOfficer.can(Permission::PaymentApprove));
        assert!(Role::FinanceOfficer.can(Permission::CompensationCalculate));
        // R&R permission lands on the RrOfficer.
        assert!(Role::RrOfficer.can(Permission::RrManage));
        // AnalyticsView lands on GovernmentReviewer.
        assert!(Role::GovernmentReviewer.can(Permission::AnalyticsView));
        // from_str on an unknown code returns None (does not panic).
        assert_eq!(Permission::from_str("not_a_real_permission"), None);
    }

    #[test]
    fn project_and_parcel_validation_rejects_invalid_data() {
        let mut parcel = valid_parcel();
        parcel.area_hectares = 0.0;
        assert!(parcel.validate().is_err());

        let mut project = valid_project();
        project.name = "  ".to_string();
        assert!(project.validate().is_err());

        let mut project = valid_project();
        project.parcels[0].district_code = "OTHER".to_string();
        assert!(project.validate().is_err());

        let mut project = valid_project();
        project.parcels.push(project.parcels[0].clone());
        assert!(matches!(
            project.validate(),
            Err(ValidationError::Duplicate { .. })
        ));
    }

    #[test]
    fn project_summary_and_detail_stay_coherent() {
        let project = valid_project();
        let summary = project.summary();
        let detail = project.detail();
        assert_eq!(summary.id, project.id);
        assert_eq!(summary.status, project.stage);
        assert_eq!(summary.parcel_count, detail.parcel_count);
        assert_eq!(summary.total_area_hectares, detail.total_area_hectares);
        assert_eq!(detail.project, project);
        assert_eq!(serde_json::to_value(summary.status).unwrap(), "draft");
    }

    #[derive(Default)]
    struct TestProjectRepository {
        projects: RwLock<HashMap<ProjectId, Project>>,
    }

    impl ProjectRepository for TestProjectRepository {
        fn list_projects(&self) -> Vec<Project> {
            self.projects
                .read()
                .expect("lock")
                .values()
                .cloned()
                .collect()
        }

        fn get_project(&self, id: ProjectId) -> Option<Project> {
            self.projects.read().expect("lock").get(&id).cloned()
        }

        fn save_project(&self, project: Project) {
            self.projects
                .write()
                .expect("lock")
                .insert(project.id, project);
        }
    }

    #[test]
    fn repository_checked_create_rejects_invalid_and_duplicate_projects() {
        let repository = TestProjectRepository::default();
        let project = valid_project();
        let id = project.id;
        assert_eq!(repository.create_project(project.clone()).unwrap().id, id);
        assert!(matches!(
            repository.create_project(project),
            Err(RepositoryError::AlreadyExists { .. })
        ));

        let invalid = Project {
            id: Uuid::new_v4(),
            name: "".to_string(),
            authority: Authority::Larr,
            state_code: "KA".to_string(),
            district_code: "BLR".to_string(),
            stage: ProjectStage::Draft,
            parcels: Vec::new(),
            preliminary_notification_at: None,
            updated_at: Utc::now(),
        };
        assert!(matches!(
            repository.create_project(invalid),
            Err(RepositoryError::Validation(_))
        ));
        assert_eq!(repository.list_project_summaries().len(), 1);
        assert_eq!(repository.get_project_detail(id).unwrap().project.id, id);
    }

    #[test]
    fn audit_chain_detects_tampering_and_sequence_gaps() {
        let actor = Uuid::new_v4();
        let first = AuditEntry::new(1, actor, "create", "project/x", serde_json::json!({}), "");
        let second = AuditEntry::new(
            2,
            actor,
            "transition",
            "project/x",
            serde_json::json!({"to": "sanctioned"}),
            first.hash.clone(),
        );
        assert!(verify_audit_chain(&[first.clone(), second.clone()]));
        let mut tampered = vec![first.clone(), second.clone()];
        tampered[0].action = "tampered".to_string();
        assert!(!verify_audit_chain(&tampered));
        let mut gap = vec![first, second];
        gap[1].sequence = 3;
        assert!(!verify_audit_chain(&gap));
    }
}
