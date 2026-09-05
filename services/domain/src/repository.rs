use crate::*;
use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Clone)]
pub struct PgProjectRepository {
    pub pool: Option<PgPool>,
    pub tenant_id: Uuid,
}

impl PgProjectRepository {
    pub fn new(pool: PgPool, tenant_id: Uuid) -> Self {
        Self { pool: Some(pool), tenant_id }
    }

    pub fn new_optional(pool: Option<PgPool>, tenant_id: Uuid) -> Self {
        Self { pool, tenant_id }
    }

    pub async fn list_projects_async(&self) -> Result<Vec<Project>, sqlx::Error> {
        let pool = match &self.pool {
            Some(p) => p,
            None => return Ok(Vec::new()),
        };

        let rows = sqlx::query(
            "SELECT id, name, authority, state_code, district_code, status, updated_at
             FROM project WHERE tenant_id = $1 ORDER BY created_at DESC"
        )
        .bind(self.tenant_id)
        .fetch_all(pool)
        .await?;

        let mut projects = Vec::new();
        for row in rows {
            let id: Uuid = row.try_get("id")?;
            let authority_str: String = row.try_get("authority")?;
            let authority = match authority_str.as_str() {
                "larr" => Authority::Larr,
                "national_highways" => Authority::NationalHighways,
                _ => continue,
            };
            let status_str: String = row.try_get("status")?;
            let stage = map_db_status_to_stage(&status_str);
            let parcels = self.list_parcels_for_project_async(id).await?;
            
            projects.push(Project {
                id,
                name: row.try_get("name")?,
                authority,
                state_code: row.try_get("state_code")?,
                district_code: row.try_get("district_code")?,
                stage,
                parcels,
                preliminary_notification_at: None,
                updated_at: row.try_get("updated_at")?,
            });
        }
        Ok(projects)
    }

    pub async fn get_project_async(&self, id: ProjectId) -> Result<Option<Project>, sqlx::Error> {
        let pool = match &self.pool {
            Some(p) => p,
            None => return Ok(None),
        };

        let row = sqlx::query(
            "SELECT id, name, authority, state_code, district_code, status, updated_at
             FROM project WHERE id = $1 AND tenant_id = $2"
        )
        .bind(id)
        .bind(self.tenant_id)
        .fetch_optional(pool)
        .await?;

        match row {
            Some(row) => {
                let authority_str: String = row.try_get("authority")?;
                let authority = match authority_str.as_str() {
                    "larr" => Authority::Larr,
                    "national_highways" => Authority::NationalHighways,
                    _ => return Ok(None),
                };
                let status_str: String = row.try_get("status")?;
                let stage = map_db_status_to_stage(&status_str);
                let project_id: Uuid = row.try_get("id")?;
                let parcels = self.list_parcels_for_project_async(project_id).await?;
                
                Ok(Some(Project {
                    id: project_id,
                    name: row.try_get("name")?,
                    authority,
                    state_code: row.try_get("state_code")?,
                    district_code: row.try_get("district_code")?,
                    stage,
                    parcels,
                    preliminary_notification_at: None,
                    updated_at: row.try_get("updated_at")?,
                }))
            }
            None => Ok(None),
        }
    }

    pub async fn save_project_async(&self, project: &Project) -> Result<(), sqlx::Error> {
        let pool = match &self.pool {
            Some(p) => p,
            None => return Ok(()),
        };

        let authority = match project.authority {
            Authority::Larr => "larr",
            Authority::NationalHighways => "national_highways",
        };
        let status = map_stage_to_db_status(project.stage);

        sqlx::query(
            "INSERT INTO project (id, tenant_id, name, authority, state_code, district_code, 
                                 status, requiring_body, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 authority = EXCLUDED.authority,
                 state_code = EXCLUDED.state_code,
                 district_code = EXCLUDED.district_code,
                 status = EXCLUDED.status,
                 updated_at = EXCLUDED.updated_at"
        )
        .bind(project.id)
        .bind(self.tenant_id)
        .bind(&project.name)
        .bind(authority)
        .bind(&project.state_code)
        .bind(&project.district_code)
        .bind(status)
        .bind("System")
        .bind(project.updated_at)
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn list_parcels_for_project_async(&self, project_id: ProjectId) -> Result<Vec<Parcel>, sqlx::Error> {
        let pool = match &self.pool {
            Some(p) => p,
            None => return Ok(Vec::new()),
        };

        let rows = sqlx::query(
            "SELECT p.id, p.survey_number, p.area_hectares, p.district_code,
                    COALESCE(o.name, 'Unknown') as owner_name
             FROM parcel p
             LEFT JOIN parcel_owner po ON p.id = po.parcel_id
             LEFT JOIN owner o ON po.owner_id = o.id
             WHERE p.project_id = $1 AND p.tenant_id = $2"
        )
        .bind(project_id)
        .bind(self.tenant_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(|row| {
            let area: rust_decimal::Decimal = row.try_get("area_hectares").unwrap_or_default();
            Parcel {
                id: row.try_get("id").unwrap_or_default(),
                survey_number: row.try_get("survey_number").unwrap_or_default(),
                owner_name: row.try_get("owner_name").unwrap_or_else(|_| "Unknown".to_string()),
                area_hectares: area.to_string().parse().unwrap_or(0.0),
                district_code: row.try_get("district_code").unwrap_or_default(),
            }
        }).collect())
    }
}

#[derive(Clone)]
pub struct PgParcelRepository {
    pub pool: Option<PgPool>,
    pub tenant_id: Uuid,
}

impl PgParcelRepository {
    pub fn new(pool: PgPool, tenant_id: Uuid) -> Self {
        Self { pool: Some(pool), tenant_id }
    }

    pub fn new_optional(pool: Option<PgPool>, tenant_id: Uuid) -> Self {
        Self { pool, tenant_id }
    }

    pub async fn list_parcels_async(&self, project_id: ProjectId) -> Result<Vec<Parcel>, sqlx::Error> {
        let pool = match &self.pool {
            Some(p) => p,
            None => return Ok(Vec::new()),
        };

        let rows = sqlx::query(
            "SELECT p.id, p.survey_number, p.area_hectares, p.district_code,
                    COALESCE(o.name, 'Unknown') as owner_name
             FROM parcel p
             LEFT JOIN parcel_owner po ON p.id = po.parcel_id
             LEFT JOIN owner o ON po.owner_id = o.id
             WHERE p.project_id = $1 AND p.tenant_id = $2"
        )
        .bind(project_id)
        .bind(self.tenant_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(|row| {
            let area: rust_decimal::Decimal = row.try_get("area_hectares").unwrap_or_default();
            Parcel {
                id: row.try_get("id").unwrap_or_default(),
                survey_number: row.try_get("survey_number").unwrap_or_default(),
                owner_name: row.try_get("owner_name").unwrap_or_else(|_| "Unknown".to_string()),
                area_hectares: area.to_string().parse().unwrap_or(0.0),
                district_code: row.try_get("district_code").unwrap_or_default(),
            }
        }).collect())
    }

    pub async fn get_parcel_async(&self, id: ParcelId) -> Result<Option<Parcel>, sqlx::Error> {
        let pool = match &self.pool {
            Some(p) => p,
            None => return Ok(None),
        };

        let row = sqlx::query(
            "SELECT p.id, p.survey_number, p.area_hectares, p.district_code,
                    COALESCE(o.name, 'Unknown') as owner_name
             FROM parcel p
             LEFT JOIN parcel_owner po ON p.id = po.parcel_id
             LEFT JOIN owner o ON po.owner_id = o.id
             WHERE p.id = $1 AND p.tenant_id = $2
             LIMIT 1"
        )
        .bind(id)
        .bind(self.tenant_id)
        .fetch_optional(pool)
        .await?;

        Ok(row.map(|row| {
            let area: rust_decimal::Decimal = row.try_get("area_hectares").unwrap_or_default();
            Parcel {
                id: row.try_get("id").unwrap_or_default(),
                survey_number: row.try_get("survey_number").unwrap_or_default(),
                owner_name: row.try_get("owner_name").unwrap_or_else(|_| "Unknown".to_string()),
                area_hectares: area.to_string().parse().unwrap_or(0.0),
                district_code: row.try_get("district_code").unwrap_or_default(),
            }
        }))
    }

    pub async fn save_parcel_async(&self, project_id: ProjectId, parcel: &Parcel) -> Result<(), sqlx::Error> {
        let pool = match &self.pool {
            Some(p) => p,
            None => return Ok(()),
        };

        let area_decimal = rust_decimal::Decimal::from_f64_retain(parcel.area_hectares).unwrap_or_default();
        
        sqlx::query(
            "INSERT INTO parcel (id, tenant_id, project_id, survey_number, area_hectares, 
                                district_code, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'verification_pending')
             ON CONFLICT (id) DO UPDATE SET
                 survey_number = EXCLUDED.survey_number,
                 area_hectares = EXCLUDED.area_hectares,
                 district_code = EXCLUDED.district_code,
                 updated_at = now()"
        )
        .bind(parcel.id)
        .bind(self.tenant_id)
        .bind(project_id)
        .bind(&parcel.survey_number)
        .bind(area_decimal)
        .bind(&parcel.district_code)
        .execute(pool)
        .await?;

        Ok(())
    }
}

#[derive(Clone)]
pub struct PgUserRepository {
    pool: PgPool,
    tenant_id: Uuid,
}

impl PgUserRepository {
    pub fn new(pool: PgPool, tenant_id: Uuid) -> Self {
        Self { pool, tenant_id }
    }

    pub async fn list_users_async(&self) -> Result<Vec<User>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT u.id, u.display_name, u.email, u.active,
                    COALESCE(ur.role_code::text, 'land_owner') as role_code,
                    COALESCE(ur.scope_level, 'public') as scope_level,
                    ur.scope_code
             FROM app_user u
             LEFT JOIN user_role_assignment ur ON u.id = ur.user_id
             WHERE u.tenant_id = $1"
        )
        .bind(self.tenant_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|row| {
            let role_code: String = row.try_get("role_code").unwrap_or_else(|_| "land_owner".to_string());
            let scope_level: String = row.try_get("scope_level").unwrap_or_else(|_| "public".to_string());
            let scope_code: Option<String> = row.try_get("scope_code").ok();
            
            let role = map_db_role(&role_code);
            let jurisdiction = map_db_jurisdiction(&scope_level, scope_code.as_deref());
            
            User {
                id: row.try_get("id").unwrap_or_default(),
                name: row.try_get("display_name").unwrap_or_default(),
                email: row.try_get("email").unwrap_or_default(),
                role,
                jurisdiction,
                active: row.try_get("active").unwrap_or(true),
            }
        }).collect())
    }

    pub async fn get_user_async(&self, id: UserId) -> Result<Option<User>, sqlx::Error> {
        let row = sqlx::query(
            "SELECT u.id, u.display_name, u.email, u.active,
                    COALESCE(ur.role_code::text, 'land_owner') as role_code,
                    COALESCE(ur.scope_level, 'public') as scope_level,
                    ur.scope_code
             FROM app_user u
             LEFT JOIN user_role_assignment ur ON u.id = ur.user_id
             WHERE u.id = $1 AND u.tenant_id = $2
             LIMIT 1"
        )
        .bind(id)
        .bind(self.tenant_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|row| {
            let role_code: String = row.try_get("role_code").unwrap_or_else(|_| "land_owner".to_string());
            let scope_level: String = row.try_get("scope_level").unwrap_or_else(|_| "public".to_string());
            let scope_code: Option<String> = row.try_get("scope_code").ok();
            
            let role = map_db_role(&role_code);
            let jurisdiction = map_db_jurisdiction(&scope_level, scope_code.as_deref());
            
            User {
                id: row.try_get("id").unwrap_or_default(),
                name: row.try_get("display_name").unwrap_or_default(),
                email: row.try_get("email").unwrap_or_default(),
                role,
                jurisdiction,
                active: row.try_get("active").unwrap_or(true),
            }
        }))
    }

    pub async fn save_user_async(&self, user: &User) -> Result<(), sqlx::Error> {
        let username = user.email.split('@').next().unwrap_or(&user.email);
        
        sqlx::query(
            "INSERT INTO app_user (id, tenant_id, username, display_name, email, active)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
                 display_name = EXCLUDED.display_name,
                 email = EXCLUDED.email,
                 active = EXCLUDED.active"
        )
        .bind(user.id)
        .bind(self.tenant_id)
        .bind(username)
        .bind(&user.name)
        .bind(&user.email)
        .bind(user.active)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

#[derive(Clone)]
pub struct PgOwnerRepository {
    pool: PgPool,
    tenant_id: Uuid,
}

impl PgOwnerRepository {
    pub fn new(pool: PgPool, tenant_id: Uuid) -> Self {
        Self { pool, tenant_id }
    }

    pub async fn list_owners_async(&self) -> Result<Vec<Owner>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, name, contact_reference, address
             FROM owner
             WHERE tenant_id = $1"
        )
        .bind(self.tenant_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|row| Owner {
            id: row.try_get("id").unwrap_or_default(),
            name: row.try_get("name").unwrap_or_default(),
            contact: row.try_get("contact_reference").ok(),
            address: row.try_get("address").ok(),
        }).collect())
    }

    pub async fn get_owner_async(&self, id: OwnerId) -> Result<Option<Owner>, sqlx::Error> {
        let row = sqlx::query(
            "SELECT id, name, contact_reference, address
             FROM owner
             WHERE id = $1 AND tenant_id = $2"
        )
        .bind(id)
        .bind(self.tenant_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|row| Owner {
            id: row.try_get("id").unwrap_or_default(),
            name: row.try_get("name").unwrap_or_default(),
            contact: row.try_get("contact_reference").ok(),
            address: row.try_get("address").ok(),
        }))
    }

    pub async fn save_owner_async(&self, owner: &Owner) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO owner (id, tenant_id, name, contact_reference, address)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
                 name = EXCLUDED.name,
                 contact_reference = EXCLUDED.contact_reference,
                 address = EXCLUDED.address"
        )
        .bind(owner.id)
        .bind(self.tenant_id)
        .bind(&owner.name)
        .bind(&owner.contact)
        .bind(&owner.address)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

fn map_db_status_to_stage(status: &str) -> ProjectStage {
    match status {
        "proposal_initiation" | "draft" => ProjectStage::ProposalInitiation,
        "land_record_verification" | "land_verification" => ProjectStage::LandRecordVerification,
        "sia_preparation" => ProjectStage::SiaPreparation,
        "sia_review" => ProjectStage::SiaReview,
        "preliminary_notification" | "notification" => ProjectStage::PreliminaryNotification,
        "objection_period" => ProjectStage::ObjectionPeriod,
        "hearing" => ProjectStage::Hearing,
        "declaration" => ProjectStage::Declaration,
        "award_preparation" => ProjectStage::AwardPreparation,
        "award_approval" | "award_generation" => ProjectStage::AwardApproval,
        "compensation_calculation" => ProjectStage::CompensationCalculation,
        "payment_processing" | "compensation" => ProjectStage::PaymentProcessing,
        "possession" => ProjectStage::Possession,
        "rr_completion" => ProjectStage::RrCompletion,
        "project_closure" | "completed" => ProjectStage::ProjectClosure,
        "lapsed" => ProjectStage::Lapsed,
        _ => ProjectStage::ProposalInitiation,
    }
}

fn map_stage_to_db_status(stage: ProjectStage) -> &'static str {
    match stage {
        ProjectStage::ProposalInitiation | ProjectStage::Draft | ProjectStage::Sanctioned => "proposal_initiation",
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

fn map_db_role(role_code: &str) -> Role {
    match role_code.to_lowercase().as_str() {
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
        _ => Role::LandOwner,
    }
}

fn map_db_jurisdiction(scope_level: &str, scope_code: Option<&str>) -> Jurisdiction {
    match scope_level {
        "national" => Jurisdiction::National,
        "state" => Jurisdiction::State {
            code: scope_code.unwrap_or("").to_string(),
        },
        "district" => Jurisdiction::District {
            code: scope_code.unwrap_or("").to_string(),
        },
        _ => Jurisdiction::Public,
    }
}
