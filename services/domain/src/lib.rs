use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{error::Error, fmt};
use uuid::Uuid;

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
    Collector,
    RevenueOfficer,
    LandOwner,
    // Source-compatibility variants for the existing workflow/API crates. They
    // are intentionally not serializable and must not be used for new data.
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
    LegalOfficer,
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
            | Self::FinanceController
            | Self::LegalOfficer
            | Self::PolicyMaker
            | Self::AuditOfficer => "admin",
            Self::Collector
            | Self::DistrictCollector
            | Self::FieldSurveyor
            | Self::RrAdministrator => "collector",
            Self::RevenueOfficer | Self::StateRevenueDepartment => "revenue_officer",
            Self::LandOwner | Self::CitizenSupportOfficer => "land_owner",
        }
    }

    pub fn permissions(self) -> &'static [Permission] {
        match self {
            Self::Admin
            | Self::CentralMinistryOfficial
            | Self::ProjectImplementingAgency
            | Self::FinanceController
            | Self::LegalOfficer
            | Self::PolicyMaker
            | Self::AuditOfficer => &ALL_PERMISSIONS,
            Self::Collector
            | Self::DistrictCollector
            | Self::FieldSurveyor
            | Self::RrAdministrator => &COLLECTOR_PERMISSIONS,
            Self::RevenueOfficer | Self::StateRevenueDepartment => &REVENUE_OFFICER_PERMISSIONS,
            Self::LandOwner | Self::CitizenSupportOfficer => &LAND_OWNER_PERMISSIONS,
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
        }
    }
}

impl fmt::Display for Permission {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

const ALL_PERMISSIONS: [Permission; 17] = [
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
];

const COLLECTOR_PERMISSIONS: [Permission; 13] = [
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
];

const REVENUE_OFFICER_PERMISSIONS: [Permission; 9] = [
    Permission::ViewProjects,
    Permission::CreateProjects,
    Permission::UpdateProjects,
    Permission::ViewParcels,
    Permission::CreateParcels,
    Permission::UpdateParcels,
    Permission::ViewOwners,
    Permission::ViewStakeholders,
    Permission::UpdateStakeholders,
];

const LAND_OWNER_PERMISSIONS: [Permission; 4] = [
    Permission::ViewProjects,
    Permission::ViewParcels,
    Permission::ViewOwners,
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
    Draft,
    Sanctioned,
    PreliminaryNotification,
    PublicHearing,
    Survey,
    CompensationAward,
    RrScheme,
    FundsDisbursed,
    Possession,
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
            Self::Draft => "draft",
            Self::Sanctioned => "sanctioned",
            Self::PreliminaryNotification => "preliminary_notification",
            Self::PublicHearing => "public_hearing",
            Self::Survey => "survey",
            Self::CompensationAward => "compensation_award",
            Self::RrScheme => "rr_scheme",
            Self::FundsDisbursed => "funds_disbursed",
            Self::Possession => "possession",
            Self::Completed => "completed",
            Self::Lapsed => "lapsed",
        }
    }

    pub fn is_terminal(self) -> bool {
        matches!(self, Self::Completed | Self::Lapsed)
    }
}

impl fmt::Display for ProjectStage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str((*self).as_str())
    }
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
