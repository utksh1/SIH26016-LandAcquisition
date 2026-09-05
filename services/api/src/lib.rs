use axum::{
    body::to_bytes,
    extract::{FromRequest, FromRequestParts, Path, Request, State},
    http::{header, request::Parts, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Duration, Utc};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sih_domain::{
    db::DbPool,
    repository::{PgParcelRepository, PgProjectRepository},
    Actor, AuditEntry, Authority, Jurisdiction, Parcel, ParcelId, Permission, Project, ProjectId,
    ProjectStage, Role, verify_audit_chain,
};
use sih_workflow::{
    advance_workflow, can_transition, get_workflow_by_project,
    initialize_workflow, ApprovalAction, WorkflowInstance,
};
use sih_integrations::{
    DemoDilrmpClient, DilrmpClient, DilrmpLookupRequest, DocumentExtractionRequest,
    DocumentExtractor, MockDelayRiskPredictor, MockDocumentExtractor,
    MockPfmsGateway, PfmsGateway, PfmsPaymentRequest, RequestContext,
    analytics::{DelayRiskPredictor, DelayRiskRequest},
};
use std::{
    collections::HashMap,
    env,
    sync::{Arc, RwLock},
};
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;

const MAX_BODY_BYTES: usize = 1024 * 1024;
const MAX_AUTHORIZATION_BYTES: usize = 8 * 1024;
const DEV_TOKEN_VERSION: &str = "dev1";
const DEFAULT_TENANT_ID: Uuid = Uuid::from_u128(1);

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ObjectionRecord {
    pub id: Uuid,
    pub project_id: ProjectId,
    pub survey_number: String,
    pub owner_name: String,
    pub objection_type: String,
    pub text: String,
    pub status: String,
    pub filed_at: DateTime<Utc>,
    pub resolution: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SubmitObjectionPayload {
    pub project_id: ProjectId,
    pub survey_number: String,
    pub owner_name: String,
    pub objection_type: String,
    pub text: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ResolveObjectionPayload {
    pub resolution: String,
    pub status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RehabilitationSummary {
    pub project_id: ProjectId,
    pub affected_families_count: usize,
    pub displaced_families_count: usize,
    pub entitlements_total: usize,
    pub entitlements_delivered: usize,
    pub status: String,
    pub last_updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UpdateRehabilitationPayload {
    pub entitlements_delivered: usize,
    pub status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DocumentRecord {
    pub id: Uuid,
    pub project_id: ProjectId,
    pub kind: String,
    pub file_name: String,
    pub content_hash: String,
    pub version: u32,
    pub signed_by: String,
    pub uploaded_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UploadDocumentPayload {
    pub project_id: ProjectId,
    pub kind: String,
    pub file_name: String,
    pub signed_by: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkflowRegimeDefinition {
    pub id: String,
    pub name: String,
    pub authority: String,
    pub stages: Vec<String>,
    pub department_mapping: HashMap<String, Vec<String>>,
    pub rules: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DepartmentDefinition {
    pub code: String,
    pub name: String,
    pub responsible_modules: Vec<String>,
    pub default_role: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EhrmsEmployee {
    pub id: String,
    pub employee_id: String,
    pub name: String,
    pub designation: String,
    pub department: String,
    pub role: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MockEhrmsLoginPayload {
    pub employee_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MockEhrmsLoginResponse {
    pub success: bool,
    pub employee: EhrmsEmployee,
}

#[derive(Clone)]
pub struct InMemoryStore {
    pub projects: HashMap<ProjectId, Project>,
    pub workflows: HashMap<Uuid, WorkflowInstance>,
    pub project_to_workflow: HashMap<ProjectId, Uuid>,
    pub approval_history: HashMap<Uuid, Vec<ApprovalAction>>,
    pub audit_log: Vec<AuditEntry>,
    pub objections: Vec<ObjectionRecord>,
    pub rehabilitation: HashMap<ProjectId, RehabilitationSummary>,
    pub documents: Vec<DocumentRecord>,
    pub ehrms_employees: HashMap<String, EhrmsEmployee>,
}

impl InMemoryStore {
    pub fn seeded() -> Self {
        let mut projects = HashMap::new();
        let mut workflows = HashMap::new();
        let mut project_to_workflow = HashMap::new();
        let mut approval_history = HashMap::new();
        let mut audit_log = Vec::new();

        // Project 1: NH-48 Package II (Bharatpur)
        let p1_id = Uuid::from_u128(101);
        let p1 = Project {
            id: p1_id,
            name: "NH-48 Package II (Bharatpur)".to_string(),
            authority: Authority::NationalHighways,
            state_code: "RJ".to_string(),
            district_code: "BTP".to_string(),
            stage: ProjectStage::Survey,
            parcels: vec![
                Parcel {
                    id: Uuid::from_u128(1001),
                    survey_number: "1042".to_string(),
                    owner_name: "Asha Devi".to_string(),
                    area_hectares: 1.25,
                    district_code: "BTP".to_string(),
                },
                Parcel {
                    id: Uuid::from_u128(1002),
                    survey_number: "1043".to_string(),
                    owner_name: "Ramesh Patel".to_string(),
                    area_hectares: 0.85,
                    district_code: "BTP".to_string(),
                },
                Parcel {
                    id: Uuid::from_u128(1003),
                    survey_number: "1044".to_string(),
                    owner_name: "Vikram Singh".to_string(),
                    area_hectares: 2.10,
                    district_code: "BTP".to_string(),
                },
                Parcel {
                    id: Uuid::from_u128(1004),
                    survey_number: "1045".to_string(),
                    owner_name: "Sunita Bai".to_string(),
                    area_hectares: 0.65,
                    district_code: "BTP".to_string(),
                },
            ],
            preliminary_notification_at: Some(Utc::now() - Duration::days(45)),
            updated_at: Utc::now(),
        };
        let w1_id = Uuid::from_u128(201);
        let h1 = sih_workflow::who_handles_stage(&ProjectStage::Survey);
        let w1 = WorkflowInstance {
            id: w1_id,
            project_id: p1_id,
            authority: Authority::NationalHighways,
            current_stage: ProjectStage::Survey,
            started_at: Utc::now() - Duration::days(45),
            notification_at: Some(Utc::now() - Duration::days(45)),
            deadline_at: Some(Utc::now() + Duration::days(320)),
            completed_at: None,
            lapsed_at: None,
            responsible_department: Some(h1.department_code.to_string()),
            responsible_role: Some(h1.role_code.to_string()),
            stage_timeline_days: Some(h1.timeline_days),
        };
        projects.insert(p1_id, p1);
        workflows.insert(w1_id, w1);
        project_to_workflow.insert(p1_id, w1_id);
        approval_history.insert(
            w1_id,
            vec![ApprovalAction {
                id: Uuid::new_v4(),
                workflow_instance_id: w1_id,
                from_stage: ProjectStage::Draft,
                to_stage: ProjectStage::Survey,
                actor_user_id: Some(Uuid::from_u128(1)),
                actor_role: Role::Collector,
                decision: "advanced".to_string(),
                reason: Some("Stage 0 scrutiny complete".to_string()),
                created_at: Utc::now() - Duration::days(45),
            }],
        );

        // Project 2: Delhi-Mumbai Expressway (Vadodara)
        let p2_id = Uuid::from_u128(102);
        let p2 = Project {
            id: p2_id,
            name: "Delhi-Mumbai Expressway (Vadodara)".to_string(),
            authority: Authority::NationalHighways,
            state_code: "GJ".to_string(),
            district_code: "VDR".to_string(),
            stage: ProjectStage::CompensationAward,
            parcels: vec![
                Parcel {
                    id: Uuid::from_u128(2001),
                    survey_number: "201".to_string(),
                    owner_name: "Kishore Bhai".to_string(),
                    area_hectares: 3.40,
                    district_code: "VDR".to_string(),
                },
                Parcel {
                    id: Uuid::from_u128(2002),
                    survey_number: "202".to_string(),
                    owner_name: "Jayesh Shah".to_string(),
                    area_hectares: 1.80,
                    district_code: "VDR".to_string(),
                },
            ],
            preliminary_notification_at: Some(Utc::now() - Duration::days(180)),
            updated_at: Utc::now(),
        };
        let w2_id = Uuid::from_u128(202);
        let h2 = sih_workflow::who_handles_stage(&ProjectStage::CompensationAward);
        let w2 = WorkflowInstance {
            id: w2_id,
            project_id: p2_id,
            authority: Authority::NationalHighways,
            current_stage: ProjectStage::CompensationAward,
            started_at: Utc::now() - Duration::days(180),
            notification_at: Some(Utc::now() - Duration::days(180)),
            deadline_at: Some(Utc::now() + Duration::days(185)),
            completed_at: None,
            lapsed_at: None,
            responsible_department: Some(h2.department_code.to_string()),
            responsible_role: Some(h2.role_code.to_string()),
            stage_timeline_days: Some(h2.timeline_days),
        };
        projects.insert(p2_id, p2);
        workflows.insert(w2_id, w2);
        project_to_workflow.insert(p2_id, w2_id);

        // Project 3: Eastern Freight Corridor
        let p3_id = Uuid::from_u128(103);
        let p3 = Project {
            id: p3_id,
            name: "Eastern Dedicated Freight Corridor".to_string(),
            authority: Authority::Larr,
            state_code: "UP".to_string(),
            district_code: "VNS".to_string(),
            stage: ProjectStage::PreliminaryNotification,
            parcels: vec![Parcel {
                id: Uuid::from_u128(3001),
                survey_number: "512".to_string(),
                owner_name: "Ram Prasad".to_string(),
                area_hectares: 2.75,
                district_code: "VNS".to_string(),
            }],
            preliminary_notification_at: Some(Utc::now() - Duration::days(30)),
            updated_at: Utc::now(),
        };
        let w3_id = Uuid::from_u128(203);
        let h3 = sih_workflow::who_handles_stage(&ProjectStage::PreliminaryNotification);
        let w3 = WorkflowInstance {
            id: w3_id,
            project_id: p3_id,
            authority: Authority::Larr,
            current_stage: ProjectStage::PreliminaryNotification,
            started_at: Utc::now() - Duration::days(30),
            notification_at: Some(Utc::now() - Duration::days(30)),
            deadline_at: Some(Utc::now() + Duration::days(335)),
            completed_at: None,
            lapsed_at: None,
            responsible_department: Some(h3.department_code.to_string()),
            responsible_role: Some(h3.role_code.to_string()),
            stage_timeline_days: Some(h3.timeline_days),
        };
        projects.insert(p3_id, p3);
        workflows.insert(w3_id, w3);
        project_to_workflow.insert(p3_id, w3_id);

        // Initial cryptographic audit log entries
        let init_entry = AuditEntry::new(
            1,
            Uuid::from_u128(1),
            "SYSTEM_INIT",
            "system",
            json!({"system": "SIH26016 LandFlow", "status": "operational"}),
            "",
        );
        let second_entry = AuditEntry::new(
            2,
            Uuid::from_u128(1),
            "PROJECT_SANCTIONED",
            "project/11111111-1111-1111-1111-111111111111",
            json!({"project": "NH-48 Package II", "status": "sanctioned"}),
            init_entry.hash.clone(),
        );
        audit_log.push(init_entry);
        audit_log.push(second_entry);

        let mut objections = Vec::new();
        objections.push(ObjectionRecord {
            id: Uuid::from_u128(5001),
            project_id: p1_id,
            survey_number: "1043".to_string(),
            owner_name: "Ramesh Patel".to_string(),
            objection_type: "Valuation & Solatium".to_string(),
            text: "Standing fruit orchard of 45 pomegranate trees not counted in joint measurement survey. Revaluation requested under Section 29.".to_string(),
            status: "filed".to_string(),
            filed_at: Utc::now() - Duration::days(5),
            resolution: None,
        });
        objections.push(ObjectionRecord {
            id: Uuid::from_u128(5002),
            project_id: p2_id,
            survey_number: "202".to_string(),
            owner_name: "Jayesh Shah".to_string(),
            objection_type: "Alignment Diversion".to_string(),
            text: "Requested 15m shift to avoid cutting through residential irrigation pump house.".to_string(),
            status: "heard".to_string(),
            filed_at: Utc::now() - Duration::days(12),
            resolution: Some("Site inspection conducted by SDM on 14 Aug 2026. Micro-alignment shifted by 8m.".to_string()),
        });

        let mut rehabilitation = HashMap::new();
        rehabilitation.insert(p1_id, RehabilitationSummary {
            project_id: p1_id,
            affected_families_count: 38,
            displaced_families_count: 12,
            entitlements_total: 76,
            entitlements_delivered: 54,
            status: "in_progress".to_string(),
            last_updated_at: Utc::now() - Duration::days(2),
        });
        rehabilitation.insert(p2_id, RehabilitationSummary {
            project_id: p2_id,
            affected_families_count: 24,
            displaced_families_count: 6,
            entitlements_total: 48,
            entitlements_delivered: 44,
            status: "nearing_completion".to_string(),
            last_updated_at: Utc::now() - Duration::days(4),
        });

        let mut documents = Vec::new();
        documents.push(DocumentRecord {
            id: Uuid::from_u128(6001),
            project_id: p1_id,
            kind: "notice".to_string(),
            file_name: "Gazette_Notification_Sec3A_NH48.pdf".to_string(),
            content_hash: "a4f89d81e3c8b1a8d05e5bf67645163f92d4f8263a0bf643c1626f8d167699bc".to_string(),
            version: 1,
            signed_by: "District Magistrate".to_string(),
            uploaded_at: Utc::now() - Duration::days(45),
        });
        documents.push(DocumentRecord {
            id: Uuid::from_u128(6002),
            project_id: p1_id,
            kind: "sia_report".to_string(),
            file_name: "SIA_Report_Bharatpur_Package2.pdf".to_string(),
            content_hash: "8c14b72ef3d607ec51e122ea6013093c3e536fe4800e6134a7d6546644f1e317".to_string(),
            version: 1,
            signed_by: "SIA Agency".to_string(),
            uploaded_at: Utc::now() - Duration::days(40),
        });

        let mut ehrms_employees = HashMap::new();
        ehrms_employees.insert(
            "EMP001".to_string(),
            EhrmsEmployee {
                id: "00000000-0000-0000-0000-000000000001".to_string(),
                employee_id: "EMP001".to_string(),
                name: "Raj Sharma".to_string(),
                designation: "Collector".to_string(),
                department: "District Administration".to_string(),
                role: "COLLECTOR".to_string(),
            },
        );
        ehrms_employees.insert(
            "EMP002".to_string(),
            EhrmsEmployee {
                id: "00000000-0000-0000-0000-000000000002".to_string(),
                employee_id: "EMP002".to_string(),
                name: "Amit Verma".to_string(),
                designation: "Revenue Officer".to_string(),
                department: "Revenue Department".to_string(),
                role: "REVENUE_OFFICER".to_string(),
            },
        );
        ehrms_employees.insert(
            "EMP003".to_string(),
            EhrmsEmployee {
                id: "00000000-0000-0000-0000-000000000003".to_string(),
                employee_id: "EMP003".to_string(),
                name: "Neha Singh".to_string(),
                designation: "GIS Officer".to_string(),
                department: "Survey Department".to_string(),
                role: "GIS_OFFICER".to_string(),
            },
        );
        ehrms_employees.insert(
            "EMP004".to_string(),
            EhrmsEmployee {
                id: "00000000-0000-0000-0000-000000000004".to_string(),
                employee_id: "EMP004".to_string(),
                name: "Ravi Kumar".to_string(),
                designation: "Finance Officer".to_string(),
                department: "Finance Department".to_string(),
                role: "FINANCE_OFFICER".to_string(),
            },
        );
        ehrms_employees.insert(
            "EMP005".to_string(),
            EhrmsEmployee {
                id: "00000000-0000-0000-0000-000000000005".to_string(),
                employee_id: "EMP005".to_string(),
                name: "Suresh Patel".to_string(),
                designation: "Rehabilitation Officer".to_string(),
                department: "R&R Department".to_string(),
                role: "REHABILITATION_OFFICER".to_string(),
            },
        );
        ehrms_employees.insert(
            "EMP006".to_string(),
            EhrmsEmployee {
                id: "00000000-0000-0000-0000-000000000006".to_string(),
                employee_id: "EMP006".to_string(),
                name: "Praveen Singhal".to_string(),
                designation: "Chief Project Officer".to_string(),
                department: "Land Requiring Body (NHAI)".to_string(),
                role: "LAND_REQUIRING_BODY".to_string(),
            },
        );
        ehrms_employees.insert(
            "EMP007".to_string(),
            EhrmsEmployee {
                id: "00000000-0000-0000-0000-000000000007".to_string(),
                employee_id: "EMP007".to_string(),
                name: "Dr. Arvinder Roy".to_string(),
                designation: "SIA Officer".to_string(),
                department: "Social Impact Assessment Unit".to_string(),
                role: "SIA_OFFICER".to_string(),
            },
        );
        ehrms_employees.insert(
            "EMP008".to_string(),
            EhrmsEmployee {
                id: "00000000-0000-0000-0000-000000000008".to_string(),
                employee_id: "EMP008".to_string(),
                name: "Harish Meena".to_string(),
                designation: "Additional Collector".to_string(),
                department: "District Collectorate / CALA".to_string(),
                role: "ADDITIONAL_COLLECTOR".to_string(),
            },
        );
        ehrms_employees.insert(
            "EMP009".to_string(),
            EhrmsEmployee {
                id: "00000000-0000-0000-0000-000000000009".to_string(),
                employee_id: "EMP009".to_string(),
                name: "Adv. Madhav Joshi".to_string(),
                designation: "Legal Officer".to_string(),
                department: "Legal & Litigation Cell".to_string(),
                role: "LEGAL_OFFICER".to_string(),
            },
        );
        ehrms_employees.insert(
            "EMP010".to_string(),
            EhrmsEmployee {
                id: "00000000-0000-0000-0000-000000000010".to_string(),
                employee_id: "EMP010".to_string(),
                name: "Meenakshi Sundaram".to_string(),
                designation: "Joint Secretary / Reviewer".to_string(),
                department: "Appropriate Government / Oversight".to_string(),
                role: "GOVERNMENT_REVIEWER".to_string(),
            },
        );

        Self {
            projects,
            workflows,
            project_to_workflow,
            approval_history,
            audit_log,
            objections,
            rehabilitation,
            documents,
            ehrms_employees,
        }
    }
}

#[derive(Clone)]
pub struct AppState {
    pub project_repo: PgProjectRepository,
    pub parcel_repo: PgParcelRepository,
    pub auth: Arc<DevAuth>,
    pub pool: Option<DbPool>,
    pub in_memory: Arc<RwLock<InMemoryStore>>,
}

impl AppState {
    pub fn new(pool: Option<DbPool>, auth: DevAuth) -> Self {
        let tenant_id = env::var("TENANT_ID")
            .ok()
            .and_then(|s| Uuid::parse_str(&s).ok())
            .unwrap_or(DEFAULT_TENANT_ID);

        let project_repo = PgProjectRepository::new_optional(pool.clone(), tenant_id);
        let parcel_repo = PgParcelRepository::new_optional(pool.clone(), tenant_id);
        let in_memory = Arc::new(RwLock::new(InMemoryStore::seeded()));

        Self {
            project_repo,
            parcel_repo,
            auth: Arc::new(auth),
            pool,
            in_memory,
        }
    }

    pub fn with_pool(pool: DbPool, auth: DevAuth) -> Self {
        Self::new(Some(pool), auth)
    }

    pub fn from_env_with_pool(pool: DbPool) -> Result<Self, String> {
        let secret = env::var("SIH_DEV_AUTH_SECRET")
            .unwrap_or_else(|_| "sih-local-demo-secret-change-me".to_string());
        let auth = DevAuth::new(secret)?;
        Ok(Self::with_pool(pool, auth))
    }

    pub fn from_env() -> Result<Self, String> {
        let secret = env::var("SIH_DEV_AUTH_SECRET")
            .unwrap_or_else(|_| "sih-local-demo-secret-change-me".to_string());
        let auth = DevAuth::new(secret)?;
        Ok(Self::new(None, auth))
    }
}

#[derive(Clone)]
pub struct DevAuth {
    secret: Arc<Vec<u8>>,
}

impl DevAuth {
    pub fn new(secret: impl AsRef<[u8]>) -> Result<Self, String> {
        let secret = secret.as_ref();
        if secret.len() < 16 {
            return Err("SIH_DEV_AUTH_SECRET must contain at least 16 bytes".to_string());
        }
        Ok(Self {
            secret: Arc::new(secret.to_vec()),
        })
    }

    pub fn issue_token(&self, actor: Actor, lifetime: Duration) -> String {
        let lifetime_seconds = lifetime.num_seconds().clamp(1, 86_400);
        let claims = DevClaims {
            actor,
            exp: Utc::now().timestamp() + lifetime_seconds,
        };
        let payload =
            serde_json::to_vec(&claims).expect("development token claims are serializable");
        let encoded_payload = encode_base64url(&payload);
        let signing_input = format!("{DEV_TOKEN_VERSION}.{encoded_payload}");
        let signature = hmac_sha256(&self.secret, signing_input.as_bytes());
        format!("{signing_input}.{}", encode_base64url(&signature))
    }

    pub fn issue_token_for(&self, actor: Actor) -> String {
        self.issue_token(actor, Duration::hours(1))
    }

    fn authenticate(&self, authorization: &HeaderValue) -> Result<Actor, ApiError> {
        let value = authorization.to_str().map_err(|_| {
            ApiError::Unauthorized("authorization header is not valid UTF-8".to_string())
        })?;
        if value.len() > MAX_AUTHORIZATION_BYTES {
            return Err(ApiError::Unauthorized(
                "authorization header is too large".to_string(),
            ));
        }
        let (scheme, token) = value.split_once(' ').ok_or_else(|| {
            ApiError::Unauthorized("expected a Bearer development token".to_string())
        })?;
        if !scheme.eq_ignore_ascii_case("bearer") || token.is_empty() {
            return Err(ApiError::Unauthorized(
                "expected a Bearer development token".to_string(),
            ));
        }

        let mut segments = token.split('.');
        let version = segments.next();
        let encoded_payload = segments.next();
        let encoded_signature = segments.next();
        if version != Some(DEV_TOKEN_VERSION)
            || encoded_payload.is_none()
            || encoded_signature.is_none()
            || segments.next().is_some()
        {
            return Err(ApiError::Unauthorized(
                "invalid development token".to_string(),
            ));
        }

        let signing_input = format!("{}.{}", version.unwrap(), encoded_payload.unwrap());
        let expected_signature = hmac_sha256(&self.secret, signing_input.as_bytes());
        let signature = decode_base64url(encoded_signature.unwrap()).ok_or_else(|| {
            ApiError::Unauthorized("invalid token signature encoding".to_string())
        })?;
        if !constant_time_equal(&expected_signature, &signature) {
            return Err(ApiError::Unauthorized(
                "development token signature mismatch".to_string(),
            ));
        }

        let payload = decode_base64url(encoded_payload.unwrap()).ok_or_else(|| {
            ApiError::Unauthorized("invalid token payload encoding".to_string())
        })?;
        let claims: DevClaims = serde_json::from_slice(&payload)
            .map_err(|_| ApiError::Unauthorized("invalid development token claims".to_string()))?;
        if claims.exp < Utc::now().timestamp() {
            return Err(ApiError::Unauthorized(
                "development token expired".to_string(),
            ));
        }
        Ok(claims.actor)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct DevClaims {
    actor: Actor,
    exp: i64,
}

#[derive(Clone, Debug)]
pub struct AuthenticatedActor(pub Actor);

impl std::ops::Deref for AuthenticatedActor {
    type Target = Actor;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[axum::async_trait]
impl FromRequestParts<AppState> for AuthenticatedActor {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        if let Some(authorization) = parts.headers.get(header::AUTHORIZATION) {
            match state.auth.authenticate(authorization) {
                Ok(actor) => return Ok(Self(actor)),
                Err(e) => return Err(e),
            }
        }
        // Dev fallback actor for demo resilience
        Ok(Self(Actor {
            id: Uuid::from_u128(1),
            role: Role::Admin,
            jurisdiction: Jurisdiction::National,
        }))
    }
}

pub struct JsonBody<T>(pub T);

#[axum::async_trait]
impl<T, S> FromRequest<S> for JsonBody<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request(req: Request, _state: &S) -> Result<Self, Self::Rejection> {
        let body = to_bytes(req.into_body(), MAX_BODY_BYTES)
            .await
            .map_err(|_| {
                ApiError::PayloadTooLarge("request body exceeds the 1 MiB limit".to_string())
            })?;
        if body.is_empty() {
            return Err(ApiError::BadRequest("request body is required".to_string()));
        }
        serde_json::from_slice(&body)
            .map(JsonBody)
            .map_err(|_| ApiError::BadRequest("request body must be valid JSON".to_string()))
    }
}

pub fn app(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([axum::http::Method::GET, axum::http::Method::POST])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);
    Router::new()
        .route("/health", get(health))
        .route("/ready", get(readiness))
        .route("/readiness", get(readiness))
        .route("/dashboard", get(dashboard))
        .route("/projects", get(list_projects).post(create_project))
        .route("/projects/:id", get(get_project))
        .route("/projects/:id/transition", post(transition))
        .route("/projects/:id/parcels", post(add_parcel))
        .route("/projects/:id/workflow/start", post(start_workflow))
        .route("/workflow/:id/advance", post(advance_workflow_endpoint))
        .route("/workflow/:id/reject", post(reject_workflow_endpoint))
        .route("/workflow/:id/history", get(workflow_history))
        .route("/parcels/:id", get(get_parcel))
        .route("/users", get(list_users))
        .route("/organizations", get(list_organizations))
        .route("/map/projects/:id", get(get_project_map))
        .route("/map/parcels", get(list_map_parcels))
        .route("/integrations/dilrmp/lookup", post(dilrmp_lookup))
        .route("/integrations/pfms/disburse", post(pfms_disburse))
        .route("/ai/extract-notice", post(ai_extract_notice))
        .route("/ai/predict-delay", post(ai_predict_delay))
        .route("/auth/login", post(auth_login))
        .route("/audit/trail", get(get_audit_trail))
        .route("/audit/verify", get(verify_audit))
        .route("/workflow/regimes", get(list_workflow_regimes))
        .route("/workflow/stages", get(list_workflow_stages))
        .route("/workflow/stages/:code", get(get_workflow_stage_by_code))
        .route("/workflow/stakeholders", get(list_workflow_stakeholders))
        .route("/departments", get(list_departments))
        .route("/objections", post(submit_objection))
        .route("/objections/project/:id", get(list_project_objections))
        .route("/objections/:id/resolve", post(resolve_objection))
        .route("/rehabilitation/project/:id", get(get_rehabilitation))
        .route("/rehabilitation/project/:id/update", post(update_rehabilitation))
        .route("/documents/upload", post(upload_document))
        .route("/documents/project/:id", get(list_project_documents))
        .route("/mock-ehrms/login", post(mock_ehrms_login))
        .route("/mock-ehrms/employees", get(list_mock_ehrms_employees))
        .layer(cors)
        .with_state(state)
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ErrorBody {
    pub error: ErrorDetail,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
}

#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    Unauthorized(String),
    Forbidden(String),
    NotFound(String),
    Conflict(String),
    PayloadTooLarge(String),
    ServiceUnavailable(String),
}

impl ApiError {
    fn code(&self) -> &'static str {
        match self {
            Self::BadRequest(_) => "bad_request",
            Self::Unauthorized(_) => "unauthorized",
            Self::Forbidden(_) => "forbidden",
            Self::NotFound(_) => "not_found",
            Self::Conflict(_) => "conflict",
            Self::PayloadTooLarge(_) => "payload_too_large",
            Self::ServiceUnavailable(_) => "service_unavailable",
        }
    }

    fn message(&self) -> &str {
        match self {
            Self::BadRequest(message)
            | Self::Unauthorized(message)
            | Self::Forbidden(message)
            | Self::NotFound(message)
            | Self::Conflict(message)
            | Self::PayloadTooLarge(message)
            | Self::ServiceUnavailable(message) => message,
        }
    }

    fn status(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::Forbidden(_) => StatusCode::FORBIDDEN,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::PayloadTooLarge(_) => StatusCode::PAYLOAD_TOO_LARGE,
            Self::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status();
        (
            status,
            Json(ErrorBody {
                error: ErrorDetail {
                    code: self.code().to_string(),
                    message: self.message().to_string(),
                },
            }),
        )
            .into_response()
    }
}

#[derive(Debug, Serialize)]
pub struct HealthStatus {
    pub status: String,
    pub service: String,
    pub timestamp: DateTime<Utc>,
}

async fn health() -> Json<HealthStatus> {
    Json(HealthStatus {
        status: "healthy".to_string(),
        service: "sih26016-api".to_string(),
        timestamp: Utc::now(),
    })
}

#[derive(Debug, Serialize)]
pub struct Dashboard {
    pub total_projects: usize,
    pub by_stage: HashMap<String, usize>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub authority: Authority,
    pub state_code: String,
    pub district_code: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct AddParcelRequest {
    pub survey_number: String,
    pub owner_name: String,
    pub area_hectares: f64,
    pub district_code: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct TransitionRequest {
    pub to: ProjectStage,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RejectRequest {
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UserSummary {
    pub id: Uuid,
    pub name: String,
    pub role: Role,
    pub jurisdiction: String,
    pub active: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OrganizationSummary {
    pub id: Uuid,
    pub name: String,
    pub code: String,
    pub ministry: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MapParcelFeature {
    pub id: Uuid,
    pub survey_number: String,
    pub owner_name: String,
    pub area_hectares: f64,
    pub status: String,
    pub color: String,
    pub coordinates: Vec<[f64; 2]>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MapProjectResponse {
    pub project_id: Uuid,
    pub name: String,
    pub authority: String,
    pub stage: String,
    pub boundary: Vec<[f64; 2]>,
    pub parcels: Vec<MapParcelFeature>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct DilrmpLookupPayload {
    pub survey_number: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PfmsDisbursePayload {
    pub project_id: String,
    pub beneficiary_reference: String,
    pub amount_paise: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ExtractNoticePayload {
    pub text: String,
    pub file_name: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PredictDelayPayload {
    pub pending_approvals: Option<u32>,
    pub timeline_delay_days: Option<u32>,
    pub dispute_count: Option<u32>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct LoginPayload {
    pub role: Role,
    pub username: Option<String>,
}

async fn readiness(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let db_status = if let Some(ref pool) = state.pool {
        match sqlx::query("SELECT 1").execute(pool).await {
            Ok(_) => "connected",
            Err(_) => "degraded",
        }
    } else {
        "resilient_memory_store"
    };

    Ok(Json(json!({
        "status": "ready",
        "service": "sih26016-api",
        "timestamp": Utc::now(),
        "database": db_status,
        "authentication": "development_signed_token"
    })))
}

async fn dashboard(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
) -> Result<Json<Dashboard>, ApiError> {
    require_permission(&actor, Permission::ViewProjects)?;
    let projects = visible_projects(&actor, &state).await?;
    let mut by_stage = HashMap::new();
    for project in &projects {
        *by_stage.entry(project.stage.to_string()).or_insert(0) += 1;
    }
    Ok(Json(Dashboard {
        total_projects: projects.len(),
        by_stage,
    }))
}

async fn list_projects(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
) -> Result<Json<Vec<Project>>, ApiError> {
    require_permission(&actor, Permission::ViewProjects)?;
    Ok(Json(visible_projects(&actor, &state).await?))
}

async fn create_project(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    JsonBody(request): JsonBody<CreateProjectRequest>,
) -> Result<(StatusCode, Json<Project>), ApiError> {
    require_permission(&actor, Permission::CreateProjects)?;
    if request.name.trim().is_empty()
        || request.state_code.trim().is_empty()
        || request.district_code.trim().is_empty()
    {
        return Err(ApiError::BadRequest(
            "name, state_code, and district_code are required".to_string(),
        ));
    }
    authorize_create(&actor, &request.state_code, &request.district_code)?;
    let project = Project {
        id: Uuid::new_v4(),
        name: request.name,
        authority: request.authority,
        state_code: request.state_code,
        district_code: request.district_code,
        stage: ProjectStage::Draft,
        parcels: Vec::new(),
        preliminary_notification_at: None,
        updated_at: Utc::now(),
    };

    // If live DB pool exists, try to persist
    if let Some(ref pool) = state.pool {
        let _ = state.project_repo.save_project_async(&project).await;
        let _ = initialize_workflow(pool, project.id, project.authority).await;
    }

    // Always update in-memory store
    let mut in_mem = state.in_memory.write().unwrap();
    in_mem.projects.insert(project.id, project.clone());
    let w_id = Uuid::new_v4();
    let init_handler = sih_workflow::who_handles_stage(&ProjectStage::ProposalInitiation);
    let init_deadline = Some(Utc::now() + chrono::Duration::days(init_handler.timeline_days as i64));
    let workflow = WorkflowInstance {
        id: w_id,
        project_id: project.id,
        authority: project.authority,
        current_stage: ProjectStage::ProposalInitiation,
        started_at: Utc::now(),
        notification_at: None,
        deadline_at: init_deadline,
        completed_at: None,
        lapsed_at: None,
        responsible_department: Some(init_handler.department_code.to_string()),
        responsible_role: Some(init_handler.role_code.to_string()),
        stage_timeline_days: Some(init_handler.timeline_days),
    };
    in_mem.workflows.insert(w_id, workflow);
    in_mem.project_to_workflow.insert(project.id, w_id);

    // Cryptographic audit log entry
    let prev_hash = in_mem
        .audit_log
        .last()
        .map(|e| e.hash.clone())
        .unwrap_or_default();
    let seq = in_mem.audit_log.len() as u64 + 1;
    let entry = AuditEntry::new(
        seq,
        actor.id,
        "CREATE_PROJECT",
        format!("project/{}", project.id),
        json!({"name": project.name, "authority": format!("{:?}", project.authority)}),
        prev_hash,
    );
    in_mem.audit_log.push(entry);

    Ok((StatusCode::CREATED, Json(project)))
}

async fn get_project(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    id: Result<Path<ProjectId>, axum::extract::rejection::PathRejection>,
) -> Result<Json<Project>, ApiError> {
    let Path(id) = id.map_err(|_| ApiError::BadRequest("project id must be a UUID".to_string()))?;
    require_permission(&actor, Permission::ViewProjects)?;

    if state.pool.is_some() {
        if let Ok(Some(project)) = state.project_repo.get_project_async(id).await {
            authorize_project_access(&actor, &project)?;
            return Ok(Json(project));
        }
    }

    let in_mem = state.in_memory.read().unwrap();
    let project = in_mem
        .projects
        .get(&id)
        .cloned()
        .ok_or_else(|| ApiError::NotFound("project not found".to_string()))?;
    authorize_project_access(&actor, &project)?;
    Ok(Json(project))
}

async fn add_parcel(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    id: Result<Path<ProjectId>, axum::extract::rejection::PathRejection>,
    JsonBody(request): JsonBody<AddParcelRequest>,
) -> Result<(StatusCode, Json<Parcel>), ApiError> {
    let Path(project_id) =
        id.map_err(|_| ApiError::BadRequest("project id must be a UUID".to_string()))?;
    require_permission(&actor, Permission::CreateParcels)?;

    let parcel = Parcel::new(
        request.survey_number,
        request.owner_name,
        request.area_hectares,
        request.district_code,
    )
    .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    if state.pool.is_some() {
        let _ = state.parcel_repo.save_parcel_async(project_id, &parcel).await;
    }

    let mut in_mem = state.in_memory.write().unwrap();
    if let Some(p) = in_mem.projects.get_mut(&project_id) {
        p.parcels.push(parcel.clone());
        p.updated_at = Utc::now();
    }

    let prev_hash = in_mem
        .audit_log
        .last()
        .map(|e| e.hash.clone())
        .unwrap_or_default();
    let seq = in_mem.audit_log.len() as u64 + 1;
    let entry = AuditEntry::new(
        seq,
        actor.id,
        "ADD_PARCEL",
        format!("parcel/{}", parcel.id),
        json!({"project_id": project_id, "survey_number": parcel.survey_number, "area": parcel.area_hectares}),
        prev_hash,
    );
    in_mem.audit_log.push(entry);

    Ok((StatusCode::CREATED, Json(parcel)))
}

async fn get_parcel(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    id: Result<Path<ParcelId>, axum::extract::rejection::PathRejection>,
) -> Result<Json<Parcel>, ApiError> {
    let Path(id) = id.map_err(|_| ApiError::BadRequest("parcel id must be a UUID".to_string()))?;
    require_permission(&actor, Permission::ViewParcels)?;

    if state.pool.is_some() {
        if let Ok(Some(parcel)) = state.parcel_repo.get_parcel_async(id).await {
            return Ok(Json(parcel));
        }
    }

    let in_mem = state.in_memory.read().unwrap();
    for p in in_mem.projects.values() {
        if let Some(parcel) = p.parcels.iter().find(|pr| pr.id == id) {
            return Ok(Json(parcel.clone()));
        }
    }

    Err(ApiError::NotFound("parcel not found".to_string()))
}

async fn transition(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    id: Result<Path<ProjectId>, axum::extract::rejection::PathRejection>,
    JsonBody(request): JsonBody<TransitionRequest>,
) -> Result<Json<Project>, ApiError> {
    let Path(id) = id.map_err(|_| ApiError::BadRequest("project id must be a UUID".to_string()))?;
    require_permission(&actor, Permission::TransitionProjects)?;

    let mut project = {
        let in_mem = state.in_memory.read().unwrap();
        in_mem
            .projects
            .get(&id)
            .cloned()
            .ok_or_else(|| ApiError::NotFound("project not found".to_string()))?
    };

    authorize_transition_for_project(&actor, &project, &request.to)?;
    let decision = can_transition(&project, &request.to, Utc::now())
        .map_err(|failure| ApiError::Conflict(failure.message))?;

    project.stage = decision.to.clone();
    project.updated_at = Utc::now();
    if project.stage == ProjectStage::PreliminaryNotification {
        project.preliminary_notification_at = Some(project.updated_at);
    }

    if let Some(ref pool) = state.pool {
        let _ = state.project_repo.save_project_async(&project).await;
        if let Ok(Some(workflow)) = get_workflow_by_project(pool, project.id).await {
            let _ = advance_workflow(
                pool,
                workflow.id,
                decision.to.clone(),
                Some(actor.id),
                actor.role,
                None,
            )
            .await;
        }
    }

    let mut in_mem = state.in_memory.write().unwrap();
    in_mem.projects.insert(project.id, project.clone());

    if let Some(&w_id) = in_mem.project_to_workflow.get(&project.id) {
        if let Some(w) = in_mem.workflows.get_mut(&w_id) {
            w.current_stage = decision.to.clone();
        }
        in_mem
            .approval_history
            .entry(w_id)
            .or_default()
            .push(ApprovalAction {
                id: Uuid::new_v4(),
                workflow_instance_id: w_id,
                from_stage: decision.from,
                to_stage: decision.to,
                actor_user_id: Some(actor.id),
                actor_role: actor.role,
                decision: "advanced".to_string(),
                reason: None,
                created_at: Utc::now(),
            });
    }

    let prev_hash = in_mem
        .audit_log
        .last()
        .map(|e| e.hash.clone())
        .unwrap_or_default();
    let seq = in_mem.audit_log.len() as u64 + 1;
    let entry = AuditEntry::new(
        seq,
        actor.id,
        "TRANSITION_STAGE",
        format!("project/{}", project.id),
        json!({"to_stage": format!("{:?}", project.stage)}),
        prev_hash,
    );
    in_mem.audit_log.push(entry);

    Ok(Json(project))
}

async fn start_workflow(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    id: Result<Path<ProjectId>, axum::extract::rejection::PathRejection>,
) -> Result<Json<WorkflowInstance>, ApiError> {
    let Path(project_id) =
        id.map_err(|_| ApiError::BadRequest("project id must be a UUID".to_string()))?;
    require_permission(&actor, Permission::TransitionProjects)?;

    let project = {
        let in_mem = state.in_memory.read().unwrap();
        in_mem
            .projects
            .get(&project_id)
            .cloned()
            .ok_or_else(|| ApiError::NotFound("project not found".to_string()))?
    };

    authorize_project_access(&actor, &project)?;

    let mut in_mem = state.in_memory.write().unwrap();
    if in_mem.project_to_workflow.contains_key(&project_id) {
        let w_id = in_mem.project_to_workflow[&project_id];
        return Ok(Json(in_mem.workflows[&w_id].clone()));
    }

    let w_id = Uuid::new_v4();
    let initial_stage = ProjectStage::ProposalInitiation;
    let handler = sih_workflow::who_handles_stage(&initial_stage);
    let now = Utc::now();
    let deadline = Some(now + chrono::Duration::days(handler.timeline_days as i64));

    let instance = WorkflowInstance {
        id: w_id,
        project_id,
        authority: project.authority,
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
    in_mem.workflows.insert(w_id, instance.clone());
    in_mem.project_to_workflow.insert(project_id, w_id);

    Ok(Json(instance))
}

async fn advance_workflow_endpoint(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    id: Result<Path<Uuid>, axum::extract::rejection::PathRejection>,
    JsonBody(request): JsonBody<TransitionRequest>,
) -> Result<Json<WorkflowInstance>, ApiError> {
    let Path(workflow_id) =
        id.map_err(|_| ApiError::BadRequest("workflow id must be a UUID".to_string()))?;
    require_permission(&actor, Permission::TransitionProjects)?;

    let mut in_mem = state.in_memory.write().unwrap();
    let (instance_clone, from, to, project_id, next_handler) = {
        let instance = in_mem
            .workflows
            .get_mut(&workflow_id)
            .ok_or_else(|| ApiError::NotFound("workflow not found".to_string()))?;

        let from = instance.current_stage;
        let to = request.to;
        let next_handler = sih_workflow::who_handles_stage(&to);
        let now = Utc::now();
        let stage_deadline = Some(now + chrono::Duration::days(next_handler.timeline_days as i64));

        instance.current_stage = to;
        instance.deadline_at = stage_deadline;
        instance.responsible_department = Some(next_handler.department_code.to_string());
        instance.responsible_role = Some(next_handler.role_code.to_string());
        instance.stage_timeline_days = Some(next_handler.timeline_days);

        if to == ProjectStage::PreliminaryNotification {
            instance.notification_at = Some(now);
        }
        if to == ProjectStage::ProjectClosure || to == ProjectStage::Completed {
            instance.completed_at = Some(now);
        }
        if to == ProjectStage::Lapsed {
            instance.lapsed_at = Some(now);
        }

        (instance.clone(), from, to, instance.project_id, next_handler)
    };

    if let Some(p) = in_mem.projects.get_mut(&project_id) {
        p.stage = to;
        p.updated_at = Utc::now();
        if to == ProjectStage::PreliminaryNotification {
            p.preliminary_notification_at = Some(Utc::now());
        }
    }

    let action = ApprovalAction {
        id: Uuid::new_v4(),
        workflow_instance_id: workflow_id,
        from_stage: from,
        to_stage: to,
        actor_user_id: Some(actor.id),
        actor_role: actor.role,
        decision: "advanced".to_string(),
        reason: None,
        created_at: Utc::now(),
    };
    in_mem
        .approval_history
        .entry(workflow_id)
        .or_default()
        .push(action);

    let prev_hash = in_mem
        .audit_log
        .last()
        .map(|e| e.hash.clone())
        .unwrap_or_default();
    let seq = in_mem.audit_log.len() as u64 + 1;
    let entry = AuditEntry::new(
        seq,
        actor.id,
        "WORKFLOW_ADVANCE",
        format!("workflow/{}", workflow_id),
        json!({
            "from": format!("{:?}", from),
            "to": format!("{:?}", to),
            "department": next_handler.department_code,
            "role": next_handler.role_code,
            "timeline_days": next_handler.timeline_days,
            "approval_authority": next_handler.approval_authority,
        }),
        prev_hash,
    );
    in_mem.audit_log.push(entry);

    Ok(Json(instance_clone))
}

async fn reject_workflow_endpoint(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    id: Result<Path<Uuid>, axum::extract::rejection::PathRejection>,
    JsonBody(request): JsonBody<RejectRequest>,
) -> Result<Json<WorkflowInstance>, ApiError> {
    let Path(workflow_id) =
        id.map_err(|_| ApiError::BadRequest("workflow id must be a UUID".to_string()))?;
    require_permission(&actor, Permission::TransitionProjects)?;

    let mut in_mem = state.in_memory.write().unwrap();
    let (instance_clone, current_stage) = {
        let instance = in_mem
            .workflows
            .get(&workflow_id)
            .ok_or_else(|| ApiError::NotFound("workflow not found".to_string()))?;
        (instance.clone(), instance.current_stage)
    };

    let action = ApprovalAction {
        id: Uuid::new_v4(),
        workflow_instance_id: workflow_id,
        from_stage: current_stage,
        to_stage: current_stage,
        actor_user_id: Some(actor.id),
        actor_role: actor.role,
        decision: "returned".to_string(),
        reason: request.reason.clone(),
        created_at: Utc::now(),
    };
    in_mem
        .approval_history
        .entry(workflow_id)
        .or_default()
        .push(action);

    let prev_hash = in_mem
        .audit_log
        .last()
        .map(|e| e.hash.clone())
        .unwrap_or_default();
    let seq = in_mem.audit_log.len() as u64 + 1;
    let entry = AuditEntry::new(
        seq,
        actor.id,
        "WORKFLOW_REJECT",
        format!("workflow/{}", workflow_id),
        json!({"reason": request.reason}),
        prev_hash,
    );
    in_mem.audit_log.push(entry);

    Ok(Json(instance_clone))
}

async fn workflow_history(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    id: Result<Path<Uuid>, axum::extract::rejection::PathRejection>,
) -> Result<Json<Vec<ApprovalAction>>, ApiError> {
    let Path(workflow_id) =
        id.map_err(|_| ApiError::BadRequest("workflow id must be a UUID".to_string()))?;
    require_permission(&actor, Permission::ViewProjects)?;

    let in_mem = state.in_memory.read().unwrap();
    let history = in_mem
        .approval_history
        .get(&workflow_id)
        .cloned()
        .unwrap_or_default();
    Ok(Json(history))
}

async fn list_users(
    AuthenticatedActor(_actor): AuthenticatedActor,
) -> Json<Vec<UserSummary>> {
    Json(vec![
        UserSummary {
            id: Uuid::from_u128(1),
            name: "Ananya Sen".to_string(),
            role: Role::Admin,
            jurisdiction: "National (Central Ministry)".to_string(),
            active: true,
        },
        UserSummary {
            id: Uuid::from_u128(2),
            name: "Vikram Singh".to_string(),
            role: Role::Collector,
            jurisdiction: "District (Bharatpur, RJ)".to_string(),
            active: true,
        },
        UserSummary {
            id: Uuid::from_u128(3),
            name: "Neha Sharma".to_string(),
            role: Role::RevenueOfficer,
            jurisdiction: "State (Rajasthan)".to_string(),
            active: true,
        },
        UserSummary {
            id: Uuid::from_u128(4),
            name: "Suresh Kumar".to_string(),
            role: Role::LandOwner,
            jurisdiction: "Public (Parcel 1042)".to_string(),
            active: true,
        },
    ])
}

async fn list_organizations(
    AuthenticatedActor(_actor): AuthenticatedActor,
) -> Json<Vec<OrganizationSummary>> {
    Json(vec![
        OrganizationSummary {
            id: Uuid::from_u128(501),
            name: "National Highways Authority of India (NHAI)".to_string(),
            code: "NHAI".to_string(),
            ministry: "Ministry of Road Transport and Highways".to_string(),
        },
        OrganizationSummary {
            id: Uuid::from_u128(502),
            name: "Indian Railways".to_string(),
            code: "RAIL".to_string(),
            ministry: "Ministry of Railways".to_string(),
        },
        OrganizationSummary {
            id: Uuid::from_u128(503),
            name: "Dedicated Freight Corridor Corporation of India".to_string(),
            code: "DFCCIL".to_string(),
            ministry: "Ministry of Railways".to_string(),
        },
        OrganizationSummary {
            id: Uuid::from_u128(504),
            name: "NTPC Green Energy Ltd".to_string(),
            code: "NTPC".to_string(),
            ministry: "Ministry of Power".to_string(),
        },
    ])
}

// Phase 4: GIS Map Endpoints
async fn get_project_map(
    Path(project_id): Path<ProjectId>,
    State(state): State<AppState>,
) -> Result<Json<MapProjectResponse>, ApiError> {
    let in_mem = state.in_memory.read().unwrap();
    let project = in_mem
        .projects
        .get(&project_id)
        .cloned()
        .ok_or_else(|| ApiError::NotFound("project not found".to_string()))?;

    let parcels = project
        .parcels
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let (status, color) = match i % 3 {
                0 => ("completed".to_string(), "#22c55e".to_string()),
                1 => ("under_process".to_string(), "#eab308".to_string()),
                _ => ("disputed".to_string(), "#ef4444".to_string()),
            };
            MapParcelFeature {
                id: p.id,
                survey_number: p.survey_number.clone(),
                owner_name: p.owner_name.clone(),
                area_hectares: p.area_hectares,
                status,
                color,
                coordinates: vec![
                    [77.45 + (i as f64 * 0.01), 27.20 + (i as f64 * 0.01)],
                    [77.47 + (i as f64 * 0.01), 27.20 + (i as f64 * 0.01)],
                    [77.47 + (i as f64 * 0.01), 27.22 + (i as f64 * 0.01)],
                    [77.45 + (i as f64 * 0.01), 27.22 + (i as f64 * 0.01)],
                ],
            }
        })
        .collect();

    Ok(Json(MapProjectResponse {
        project_id,
        name: project.name,
        authority: format!("{:?}", project.authority),
        stage: format!("{:?}", project.stage),
        boundary: vec![
            [77.40, 27.15],
            [77.55, 27.15],
            [77.55, 27.30],
            [77.40, 27.30],
        ],
        parcels,
    }))
}

async fn list_map_parcels(State(state): State<AppState>) -> Json<Vec<MapParcelFeature>> {
    let in_mem = state.in_memory.read().unwrap();
    let mut features = Vec::new();
    let mut idx = 0;

    for project in in_mem.projects.values() {
        for p in &project.parcels {
            let (status, color) = match idx % 3 {
                0 => ("completed".to_string(), "#22c55e".to_string()),     // Green
                1 => ("under_process".to_string(), "#eab308".to_string()), // Yellow
                _ => ("disputed".to_string(), "#ef4444".to_string()),      // Red
            };
            features.push(MapParcelFeature {
                id: p.id,
                survey_number: p.survey_number.clone(),
                owner_name: p.owner_name.clone(),
                area_hectares: p.area_hectares,
                status,
                color,
                coordinates: vec![
                    [77.45 + (idx as f64 * 0.008), 27.20 + (idx as f64 * 0.008)],
                    [77.465 + (idx as f64 * 0.008), 27.20 + (idx as f64 * 0.008)],
                    [77.465 + (idx as f64 * 0.008), 27.215 + (idx as f64 * 0.008)],
                    [77.45 + (idx as f64 * 0.008), 27.215 + (idx as f64 * 0.008)],
                ],
            });
            idx += 1;
        }
    }
    Json(features)
}

// Phase 5: Integration & AI Endpoints
async fn dilrmp_lookup(
    JsonBody(payload): JsonBody<DilrmpLookupPayload>,
) -> Result<Json<Value>, ApiError> {
    let client = DemoDilrmpClient::default();
    let ctx = RequestContext::new(Uuid::new_v4().to_string());
    let req = DilrmpLookupRequest::new(ctx, payload.survey_number.clone());
    let record = client
        .lookup(&req)
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(Json(json!({
        "survey_number": record.survey_number,
        "owner_name": record.owner_name,
        "area_hectares": record.area_hectares,
        "ulpin": record.ulpin,
        "land_classification": "agricultural",
        "status": "verified",
        "provider": "DILRMP/Bhulekh"
    })))
}

async fn pfms_disburse(
    JsonBody(payload): JsonBody<PfmsDisbursePayload>,
) -> Result<Json<Value>, ApiError> {
    let gateway = MockPfmsGateway::default();
    let req = PfmsPaymentRequest {
        project_id: payload.project_id.clone(),
        beneficiary_reference: payload.beneficiary_reference.clone(),
        amount_paise: payload.amount_paise,
    };
    let res = gateway.submit_payment(&req);

    Ok(Json(json!({
        "reference": res.reference,
        "status": "settled",
        "utr_number": format!("UTR2026{:08}", rand_simple(10_000_000)),
        "amount_paise": payload.amount_paise,
        "amount_inr": payload.amount_paise as f64 / 100.0,
        "timestamp": Utc::now()
    })))
}

async fn ai_extract_notice(
    JsonBody(payload): JsonBody<ExtractNoticePayload>,
) -> Result<Json<Value>, ApiError> {
    let extractor = MockDocumentExtractor::default();
    let ctx = RequestContext::new(Uuid::new_v4().to_string());
    let req = DocumentExtractionRequest::from_text(ctx, payload.text);
    let result = extractor
        .extract(&req)
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(Json(json!({
        "survey_number": result.survey_number.unwrap_or_else(|| "1042".to_string()),
        "owner_name": result.owner_name.unwrap_or_else(|| "Asha Devi".to_string()),
        "area_hectares": result.area_hectares.unwrap_or(1.25),
        "confidence": 0.94,
        "source": "DocumentAI_OCR_LayoutParser"
    })))
}

async fn ai_predict_delay(
    JsonBody(payload): JsonBody<PredictDelayPayload>,
) -> Result<Json<Value>, ApiError> {
    let predictor = MockDelayRiskPredictor::default();
    let ctx = RequestContext::new(Uuid::new_v4().to_string());
    let req = DelayRiskRequest::new(
        ctx,
        payload.pending_approvals.unwrap_or(2),
        payload.dispute_count.unwrap_or(1),
        payload.timeline_delay_days.unwrap_or(14),
    );
    let result = predictor
        .predict(&req)
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    Ok(Json(json!({
        "score": result.score,
        "level": format!("{:?}", result.level).to_lowercase(),
        "factors": result.factors
    })))
}

// Phase 6: Security & Audit Endpoints
async fn auth_login(
    State(state): State<AppState>,
    JsonBody(payload): JsonBody<LoginPayload>,
) -> Result<Json<Value>, ApiError> {
    let (user_id, display_name, jurisdiction) = match payload.role {
        Role::Admin => (
            Uuid::from_u128(1),
            "Ananya Sen",
            Jurisdiction::National,
        ),
        Role::Collector => (
            Uuid::from_u128(2),
            "Vikram Singh",
            Jurisdiction::District {
                code: "BTP".to_string(),
            },
        ),
        Role::RevenueOfficer => (
            Uuid::from_u128(3),
            "Neha Sharma",
            Jurisdiction::State {
                code: "RJ".to_string(),
            },
        ),
        Role::LandOwner => (
            Uuid::from_u128(4),
            "Suresh Kumar",
            Jurisdiction::Public,
        ),
        _ => (
            Uuid::from_u128(1),
            "Admin User",
            Jurisdiction::National,
        ),
    };

    let actor = Actor {
        id: user_id,
        role: payload.role,
        jurisdiction: jurisdiction.clone(),
    };

    let token = state.auth.issue_token_for(actor);

    Ok(Json(json!({
        "token": token,
        "role": payload.role,
        "user_id": user_id,
        "display_name": display_name,
        "jurisdiction": format!("{:?}", jurisdiction)
    })))
}

async fn get_audit_trail(State(state): State<AppState>) -> Json<Vec<AuditEntry>> {
    let in_mem = state.in_memory.read().unwrap();
    Json(in_mem.audit_log.clone())
}

async fn verify_audit(State(state): State<AppState>) -> Json<Value> {
    let in_mem = state.in_memory.read().unwrap();
    let verified = verify_audit_chain(&in_mem.audit_log);
    let head_hash = in_mem
        .audit_log
        .last()
        .map(|e| e.hash.clone())
        .unwrap_or_default();
    Json(json!({
        "verified": verified,
        "entries_count": in_mem.audit_log.len(),
        "chain_head": head_hash
    }))
}

async fn list_workflow_regimes() -> Json<Vec<WorkflowRegimeDefinition>> {
    let mut rfctlarr_dept = HashMap::new();
    rfctlarr_dept.insert("Proposal Initiation".to_string(), vec!["Land Requiring Body".to_string()]);
    rfctlarr_dept.insert("Land Record Verification".to_string(), vec!["State Revenue Department".to_string(), "Survey & Geo-informatics Wing".to_string()]);
    rfctlarr_dept.insert("SIA Preparation".to_string(), vec!["Social Impact Assessment Unit".to_string()]);
    rfctlarr_dept.insert("SIA Review".to_string(), vec!["Social Impact Assessment Unit".to_string(), "Independent Expert Group".to_string()]);
    rfctlarr_dept.insert("Preliminary Notification (Sec 11)".to_string(), vec!["District Collectorate / CALA".to_string()]);
    rfctlarr_dept.insert("Objection Period (Sec 15)".to_string(), vec!["Public Citizen Transparency Desk".to_string(), "Land Owner".to_string()]);
    rfctlarr_dept.insert("Hearing & Disposal".to_string(), vec!["District Collectorate / CALA".to_string()]);
    rfctlarr_dept.insert("Declaration (Sec 19)".to_string(), vec!["Appropriate Government / Oversight".to_string()]);
    rfctlarr_dept.insert("Award Preparation (Sec 23)".to_string(), vec!["District Collectorate / CALA".to_string(), "Legal & Litigation Cell".to_string()]);
    rfctlarr_dept.insert("Award Approval".to_string(), vec!["District Collectorate / CALA".to_string()]);
    rfctlarr_dept.insert("Compensation Calculation".to_string(), vec!["Finance & PFMS Division".to_string()]);
    rfctlarr_dept.insert("Payment Processing".to_string(), vec!["Finance & PFMS Division".to_string()]);
    rfctlarr_dept.insert("Possession (Sec 38)".to_string(), vec!["District Collectorate / CALA".to_string()]);
    rfctlarr_dept.insert("R&R Completion".to_string(), vec!["Resettlement & Rehabilitation Directorate".to_string()]);
    rfctlarr_dept.insert("Project Closure".to_string(), vec!["Appropriate Government / Oversight".to_string()]);

    let mut nh_dept = HashMap::new();
    nh_dept.insert("Project Created".to_string(), vec!["NHAI".to_string()]);
    nh_dept.insert("Land Verification".to_string(), vec!["Revenue Officer".to_string()]);
    nh_dept.insert("Notification (3A)".to_string(), vec!["CALA / Collector".to_string()]);
    nh_dept.insert("Objection Period (3C)".to_string(), vec!["CALA / Collector".to_string()]);
    nh_dept.insert("Award (3G)".to_string(), vec!["CALA / Collector".to_string()]);
    nh_dept.insert("Compensation (3H)".to_string(), vec!["Finance".to_string()]);
    nh_dept.insert("Possession".to_string(), vec!["CALA".to_string()]);

    let mut railway_dept = HashMap::new();
    railway_dept.insert("Sanction".to_string(), vec!["Ministry of Railways".to_string()]);
    railway_dept.insert("Verification (20A)".to_string(), vec!["Competent Authority".to_string()]);
    railway_dept.insert("Declaration (20E)".to_string(), vec!["Central Govt".to_string()]);
    railway_dept.insert("Award (20F)".to_string(), vec!["Competent Authority".to_string()]);
    railway_dept.insert("Payment".to_string(), vec!["Finance".to_string()]);
    railway_dept.insert("Possession".to_string(), vec!["Railways Agency".to_string()]);

    let mut pipeline_dept = HashMap::new();
    pipeline_dept.insert("Proposal".to_string(), vec!["Petroleum Agency".to_string()]);
    pipeline_dept.insert("Notification (3)".to_string(), vec!["Competent Authority".to_string()]);
    pipeline_dept.insert("Objections (5)".to_string(), vec!["Competent Authority".to_string()]);
    pipeline_dept.insert("Right of User (6)".to_string(), vec!["Central Govt".to_string()]);
    pipeline_dept.insert("Compensation".to_string(), vec!["Finance".to_string()]);
    pipeline_dept.insert("Possession".to_string(), vec!["Pipeline Operator".to_string()]);

    Json(vec![
        WorkflowRegimeDefinition {
            id: "rfctlarr_2013".to_string(),
            name: "RFCTLARR Act 2013 (Right to Fair Compensation & Transparency)".to_string(),
            authority: "larr".to_string(),
            stages: vec![
                "Proposal Initiation".to_string(),
                "Land Record Verification".to_string(),
                "SIA Preparation".to_string(),
                "SIA Review".to_string(),
                "Preliminary Notification (Sec 11)".to_string(),
                "Objection Period (Sec 15)".to_string(),
                "Hearing & Disposal".to_string(),
                "Declaration (Sec 19)".to_string(),
                "Award Preparation (Sec 23)".to_string(),
                "Award Approval".to_string(),
                "Compensation Calculation".to_string(),
                "Payment Processing".to_string(),
                "Possession (Sec 38)".to_string(),
                "R&R Completion".to_string(),
                "Project Closure".to_string(),
            ],
            department_mapping: rfctlarr_dept,
            rules: vec![
                "Section 11 Preliminary Notification freeze on land transactions".to_string(),
                "Section 15 statutory 60-day objection filing window".to_string(),
                "Section 19 Declaration mandatory within 12 months of Section 11 notice (lapse prevention)".to_string(),
                "Section 23/26 determination of true market value & 100% Solatium under First Schedule".to_string(),
                "Section 30(3) 12% per annum additional interest accrual from notification to award".to_string(),
                "Section 38 possession only after full compensation deposit/disbursement".to_string(),
                "Second Schedule mandatory R&R entitlements delivery prior to closure".to_string(),
            ],
        },
        WorkflowRegimeDefinition {
            id: "nh_act_1956".to_string(),
            name: "National Highways Act 1956".to_string(),
            authority: "national_highways".to_string(),
            stages: vec![
                "Project Created".to_string(),
                "Land Verification".to_string(),
                "Notification (3A)".to_string(),
                "Objection Period (3C)".to_string(),
                "Award (3G)".to_string(),
                "Compensation (3H)".to_string(),
                "Possession".to_string(),
            ],
            department_mapping: nh_dept,
            rules: vec![
                "Hard statutory limit: Section 3D declaration must occur within 1 year of 3A notice or acquisition lapses".to_string(),
                "Hearing of objections under Section 3C by CALA".to_string(),
                "Vesting of land under Section 3D in Central Government".to_string(),
            ],
        },
        WorkflowRegimeDefinition {
            id: "railways_act_2008".to_string(),
            name: "Railways Act (Amendment) 2008".to_string(),
            authority: "railways".to_string(),
            stages: vec![
                "Sanction".to_string(),
                "Verification (20A)".to_string(),
                "Public Hearing".to_string(),
                "Declaration (20E)".to_string(),
                "Award (20F)".to_string(),
                "Payment".to_string(),
                "Possession".to_string(),
            ],
            department_mapping: railway_dept,
            rules: vec![
                "Special Railway Project notification under Section 20A".to_string(),
                "Section 20E declaration within 1 year".to_string(),
            ],
        },
        WorkflowRegimeDefinition {
            id: "pipeline_act_1962".to_string(),
            name: "Petroleum & Minerals Pipelines Act 1962".to_string(),
            authority: "pipeline".to_string(),
            stages: vec![
                "Proposal".to_string(),
                "Notification (3)".to_string(),
                "Objections (5)".to_string(),
                "Right of User (6)".to_string(),
                "Compensation".to_string(),
                "Possession".to_string(),
            ],
            department_mapping: pipeline_dept,
            rules: vec![
                "Acquisition of Right of User (RoU) rather than full title".to_string(),
                "10% of market value as RoU compensation".to_string(),
            ],
        },
    ])
}

async fn list_workflow_stages() -> Json<Vec<sih_domain::StageDefinition>> {
    Json(sih_workflow::get_all_stage_definitions())
}

async fn get_workflow_stage_by_code(
    Path(stage_code): Path<String>,
) -> Result<Json<sih_domain::StageDefinition>, ApiError> {
    let stages = sih_workflow::get_all_stage_definitions();
    let stage = stages
        .into_iter()
        .find(|s| s.stage_code.eq_ignore_ascii_case(&stage_code))
        .ok_or_else(|| ApiError::NotFound(format!("Workflow stage '{}' not found", stage_code)))?;
    Ok(Json(stage))
}

#[derive(Serialize)]
struct StakeholderRegistryResponse {
    departments: Vec<sih_domain::DepartmentInfo>,
    roles: Vec<sih_domain::RoleInfo>,
}

async fn list_workflow_stakeholders() -> Json<StakeholderRegistryResponse> {
    Json(StakeholderRegistryResponse {
        departments: sih_workflow::list_statutory_departments(),
        roles: sih_workflow::list_statutory_roles(),
    })
}

async fn list_departments() -> Json<Vec<DepartmentDefinition>> {
    Json(vec![
        DepartmentDefinition {
            code: "requiring_body".to_string(),
            name: "Land Requiring Body (NHAI / Infrastructure)".to_string(),
            responsible_modules: vec![
                "Project Proposal".to_string(),
                "DPR Upload".to_string(),
                "Acquisition Requisition".to_string(),
                "Alignment Definition".to_string(),
            ],
            default_role: "Requiring Body".to_string(),
        },
        DepartmentDefinition {
            code: "revenue".to_string(),
            name: "State Revenue Department".to_string(),
            responsible_modules: vec![
                "Land Verification".to_string(),
                "Ownership Check".to_string(),
                "DILRMP Live Sync".to_string(),
                "Record Mutation".to_string(),
            ],
            default_role: "Revenue Officer".to_string(),
        },
        DepartmentDefinition {
            code: "gis".to_string(),
            name: "GIS & Survey Department".to_string(),
            responsible_modules: vec![
                "Cadastral Mapping".to_string(),
                "Parcel Geometry Verification".to_string(),
                "Drone / DGPS Evidence".to_string(),
                "Encroachment Overlays".to_string(),
            ],
            default_role: "GIS Survey Officer".to_string(),
        },
        DepartmentDefinition {
            code: "cala".to_string(),
            name: "District Collectorate / CALA".to_string(),
            responsible_modules: vec![
                "Statutory Notifications".to_string(),
                "SIA Approvals".to_string(),
                "Section 15 Objections & Hearings".to_string(),
                "Award Determination & DSC Sign-off".to_string(),
            ],
            default_role: "Collector".to_string(),
        },
        DepartmentDefinition {
            code: "finance".to_string(),
            name: "Finance Department / PFMS".to_string(),
            responsible_modules: vec![
                "Solatium & Interest Valuation".to_string(),
                "PFMS Direct Benefit Transfer".to_string(),
                "UTR Tracking".to_string(),
                "Disbursement Reconciliation".to_string(),
            ],
            default_role: "Finance Officer".to_string(),
        },
        DepartmentDefinition {
            code: "rehabilitation".to_string(),
            name: "Rehabilitation & Resettlement (R&R)".to_string(),
            responsible_modules: vec![
                "Affected Families Census".to_string(),
                "Entitlement Delivery".to_string(),
                "Resettlement Housing Allocation".to_string(),
                "Possession & Handover Clearance".to_string(),
            ],
            default_role: "Rehabilitation Officer".to_string(),
        },
    ])
}

async fn submit_objection(
    State(state): State<AppState>,
    JsonBody(payload): JsonBody<SubmitObjectionPayload>,
) -> Result<Json<ObjectionRecord>, ApiError> {
    let mut in_mem = state.in_memory.write().unwrap();
    let record = ObjectionRecord {
        id: Uuid::new_v4(),
        project_id: payload.project_id,
        survey_number: payload.survey_number.clone(),
        owner_name: payload.owner_name.clone(),
        objection_type: payload.objection_type.clone(),
        text: payload.text.clone(),
        status: "filed".to_string(),
        filed_at: Utc::now(),
        resolution: None,
    };

    let prev_hash = in_mem.audit_log.last().map(|e| e.hash.clone()).unwrap_or_default();
    let next_seq = (in_mem.audit_log.len() + 1) as u64;
    let audit_entry = AuditEntry::new(
        next_seq,
        payload.project_id,
        "OBJECTION_FILED",
        &format!("parcel/{}", payload.survey_number),
        json!({
            "owner": payload.owner_name,
            "type": payload.objection_type,
            "survey": payload.survey_number
        }),
        prev_hash,
    );
    in_mem.audit_log.push(audit_entry);
    in_mem.objections.push(record.clone());

    Ok(Json(record))
}

async fn list_project_objections(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> Json<Vec<ObjectionRecord>> {
    let in_mem = state.in_memory.read().unwrap();
    let matches: Vec<ObjectionRecord> = in_mem
        .objections
        .iter()
        .filter(|o| o.project_id == project_id)
        .cloned()
        .collect();
    Json(matches)
}

async fn resolve_objection(
    State(state): State<AppState>,
    Path(objection_id): Path<Uuid>,
    JsonBody(payload): JsonBody<ResolveObjectionPayload>,
) -> Result<Json<ObjectionRecord>, ApiError> {
    let mut in_mem = state.in_memory.write().unwrap();
    let objection = in_mem
        .objections
        .iter_mut()
        .find(|o| o.id == objection_id)
        .ok_or_else(|| ApiError::NotFound("Objection not found".to_string()))?;

    objection.status = payload.status;
    objection.resolution = Some(payload.resolution);
    let record = objection.clone();

    let prev_hash = in_mem.audit_log.last().map(|e| e.hash.clone()).unwrap_or_default();
    let next_seq = (in_mem.audit_log.len() + 1) as u64;
    let audit_entry = AuditEntry::new(
        next_seq,
        record.project_id,
        "OBJECTION_RESOLVED",
        &format!("objection/{}", record.id),
        json!({
            "status": record.status,
            "resolution": record.resolution
        }),
        prev_hash,
    );
    in_mem.audit_log.push(audit_entry);

    Ok(Json(record))
}

async fn get_rehabilitation(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> Json<RehabilitationSummary> {
    let in_mem = state.in_memory.read().unwrap();
    if let Some(r) = in_mem.rehabilitation.get(&project_id) {
        Json(r.clone())
    } else {
        Json(RehabilitationSummary {
            project_id,
            affected_families_count: 15,
            displaced_families_count: 4,
            entitlements_total: 30,
            entitlements_delivered: 22,
            status: "in_progress".to_string(),
            last_updated_at: Utc::now(),
        })
    }
}

async fn update_rehabilitation(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
    JsonBody(payload): JsonBody<UpdateRehabilitationPayload>,
) -> Result<Json<RehabilitationSummary>, ApiError> {
    let mut in_mem = state.in_memory.write().unwrap();
    let summary = in_mem.rehabilitation.entry(project_id).or_insert(RehabilitationSummary {
        project_id,
        affected_families_count: 38,
        displaced_families_count: 12,
        entitlements_total: 76,
        entitlements_delivered: 0,
        status: "in_progress".to_string(),
        last_updated_at: Utc::now(),
    });

    summary.entitlements_delivered = payload.entitlements_delivered;
    summary.status = payload.status;
    summary.last_updated_at = Utc::now();
    let record = summary.clone();

    let prev_hash = in_mem.audit_log.last().map(|e| e.hash.clone()).unwrap_or_default();
    let next_seq = (in_mem.audit_log.len() + 1) as u64;
    let audit_entry = AuditEntry::new(
        next_seq,
        project_id,
        "REHABILITATION_UPDATED",
        &format!("rehabilitation/{}", project_id),
        json!({
            "entitlements_delivered": record.entitlements_delivered,
            "status": record.status
        }),
        prev_hash,
    );
    in_mem.audit_log.push(audit_entry);

    Ok(Json(record))
}

async fn upload_document(
    State(state): State<AppState>,
    JsonBody(payload): JsonBody<UploadDocumentPayload>,
) -> Result<Json<DocumentRecord>, ApiError> {
    let mut in_mem = state.in_memory.write().unwrap();
    let mut hasher = Sha256::new();
    hasher.update(payload.file_name.as_bytes());
    hasher.update(payload.kind.as_bytes());
    hasher.update(Utc::now().to_rfc3339().as_bytes());
    let content_hash = format!("{:x}", hasher.finalize());

    let record = DocumentRecord {
        id: Uuid::new_v4(),
        project_id: payload.project_id,
        kind: payload.kind.clone(),
        file_name: payload.file_name.clone(),
        content_hash,
        version: 1,
        signed_by: payload.signed_by.clone(),
        uploaded_at: Utc::now(),
    };

    let prev_hash = in_mem.audit_log.last().map(|e| e.hash.clone()).unwrap_or_default();
    let next_seq = (in_mem.audit_log.len() + 1) as u64;
    let audit_entry = AuditEntry::new(
        next_seq,
        payload.project_id,
        "DOCUMENT_UPLOADED",
        &format!("document/{}", record.id),
        json!({
            "kind": record.kind,
            "file_name": record.file_name,
            "hash": record.content_hash
        }),
        prev_hash,
    );
    in_mem.audit_log.push(audit_entry);
    in_mem.documents.push(record.clone());

    Ok(Json(record))
}

async fn list_project_documents(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> Json<Vec<DocumentRecord>> {
    let in_mem = state.in_memory.read().unwrap();
    let matches: Vec<DocumentRecord> = in_mem
        .documents
        .iter()
        .filter(|d| d.project_id == project_id)
        .cloned()
        .collect();
    Json(matches)
}

async fn mock_ehrms_login(
    State(state): State<AppState>,
    JsonBody(payload): JsonBody<MockEhrmsLoginPayload>,
) -> Result<Json<MockEhrmsLoginResponse>, ApiError> {
    let emp_id = payload.employee_id.trim().to_uppercase();
    let in_mem = state.in_memory.read().unwrap();
    if let Some(employee) = in_mem.ehrms_employees.get(&emp_id) {
        Ok(Json(MockEhrmsLoginResponse {
            success: true,
            employee: employee.clone(),
        }))
    } else {
        Err(ApiError::NotFound(format!(
            "Employee ID '{}' not found in eHRMS registry. Valid demo IDs: EMP001 to EMP010",
            payload.employee_id
        )))
    }
}

async fn list_mock_ehrms_employees(
    State(state): State<AppState>,
) -> Json<Vec<EhrmsEmployee>> {
    let in_mem = state.in_memory.read().unwrap();
    let mut list: Vec<EhrmsEmployee> = in_mem.ehrms_employees.values().cloned().collect();
    list.sort_by(|a, b| a.employee_id.cmp(&b.employee_id));
    Json(list)
}

// Helpers
fn rand_simple(modulus: u64) -> u64 {
    (Utc::now().timestamp_nanos_opt().unwrap_or(12345678) as u64) % modulus
}

async fn visible_projects(actor: &Actor, state: &AppState) -> Result<Vec<Project>, ApiError> {
    if state.pool.is_some() {
        if let Ok(all_projects) = state.project_repo.list_projects_async().await {
            if !all_projects.is_empty() {
                return Ok(all_projects
                    .into_iter()
                    .filter(|p| jurisdiction_matches(actor, p))
                    .collect());
            }
        }
    }
    let in_mem = state.in_memory.read().unwrap();
    Ok(in_mem
        .projects
        .values()
        .cloned()
        .filter(|p| jurisdiction_matches(actor, p))
        .collect())
}

fn is_supported_role(role: Role) -> bool {
    matches!(
        role,
        Role::Admin
            | Role::LandRequiringBody
            | Role::Collector
            | Role::AdditionalCollector
            | Role::RevenueOfficer
            | Role::GisOfficer
            | Role::SiaOfficer
            | Role::LegalOfficer
            | Role::FinanceOfficer
            | Role::RrOfficer
            | Role::GovernmentReviewer
            | Role::LandOwner
    )
}

fn require_permission(actor: &Actor, permission: Permission) -> Result<(), ApiError> {
    if !is_supported_role(actor.role) || !actor.role.can(permission) {
        return Err(ApiError::Forbidden(format!(
            "role {} cannot perform this action",
            actor.role
        )));
    }
    Ok(())
}

fn authorize_create(actor: &Actor, state_code: &str, district_code: &str) -> Result<(), ApiError> {
    let allowed = match (&actor.role, &actor.jurisdiction) {
        (Role::Admin | Role::LandRequiringBody | Role::GovernmentReviewer, Jurisdiction::National) => true,
        (Role::LandRequiringBody, _) => true,
        (Role::RevenueOfficer, Jurisdiction::State { code }) => code == state_code,
        (Role::Collector | Role::AdditionalCollector, Jurisdiction::District { code }) => code == district_code,
        (
            Role::Collector,
            Jurisdiction::Field {
                district_code: code,
            },
        ) => code == district_code,
        (Role::LandOwner, Jurisdiction::Public) => false,
        _ => actor.role != Role::LandOwner,
    };
    if !allowed {
        return Err(ApiError::Forbidden(
            "actor jurisdiction does not permit creating this project".to_string(),
        ));
    }
    Ok(())
}

fn jurisdiction_matches(actor: &Actor, project: &Project) -> bool {
    match (&actor.role, &actor.jurisdiction) {
        (Role::Admin | Role::LandRequiringBody | Role::GovernmentReviewer, Jurisdiction::National) => true,
        (Role::RevenueOfficer, Jurisdiction::State { code }) => code == &project.state_code,
        (
            Role::Collector
            | Role::AdditionalCollector
            | Role::GisOfficer
            | Role::SiaOfficer
            | Role::LegalOfficer
            | Role::FinanceOfficer
            | Role::RrOfficer,
            Jurisdiction::District { code },
        ) => code == &project.district_code,
        (Role::Collector | Role::RevenueOfficer, Jurisdiction::Field { district_code }) => {
            district_code == &project.district_code
        }
        (Role::LandOwner, Jurisdiction::Public) => true,
        _ => true,
    }
}

fn authorize_project_access(actor: &Actor, project: &Project) -> Result<(), ApiError> {
    require_permission(actor, Permission::ViewProjects)?;
    if !jurisdiction_matches(actor, project) {
        return Err(ApiError::Forbidden(
            "actor jurisdiction does not permit access to this project".to_string(),
        ));
    }
    Ok(())
}

pub fn authorize_transition(actor: &Actor, target: &ProjectStage) -> Result<(), ApiError> {
    require_permission(actor, Permission::TransitionProjects)?;
    let role_allowed = match (&actor.role, target) {
        (Role::Admin | Role::Collector, _) => true,
        (
            Role::LandRequiringBody,
            ProjectStage::ProposalInitiation
                | ProjectStage::LandRecordVerification
                | ProjectStage::Draft
                | ProjectStage::Sanctioned,
        ) => true,
        (
            Role::RevenueOfficer,
            ProjectStage::LandRecordVerification
                | ProjectStage::SiaPreparation
                | ProjectStage::Sanctioned,
        ) => true,
        (
            Role::GisOfficer,
            ProjectStage::LandRecordVerification | ProjectStage::Survey,
        ) => true,
        (
            Role::SiaOfficer,
            ProjectStage::SiaPreparation
                | ProjectStage::SiaReview
                | ProjectStage::PreliminaryNotification,
        ) => true,
        (
            Role::AdditionalCollector,
            ProjectStage::AwardPreparation
                | ProjectStage::AwardApproval
                | ProjectStage::CompensationCalculation
                | ProjectStage::CompensationAward,
        ) => true,
        (Role::LegalOfficer, ProjectStage::Hearing | ProjectStage::AwardPreparation) => true,
        (
            Role::FinanceOfficer,
            ProjectStage::CompensationCalculation
                | ProjectStage::PaymentProcessing
                | ProjectStage::FundsDisbursed,
        ) => true,
        (Role::RrOfficer, ProjectStage::RrCompletion | ProjectStage::RrScheme) => true,
        (
            Role::GovernmentReviewer,
            ProjectStage::Declaration
                | ProjectStage::ProjectClosure
                | ProjectStage::Completed,
        ) => true,
        (Role::LandOwner, _) => false,
        _ => false,
    };
    if !role_allowed {
        return Err(ApiError::Forbidden(format!(
            "role {} cannot perform transition to {}",
            actor.role, target
        )));
    }
    if !valid_transition_jurisdiction(actor) {
        return Err(ApiError::Forbidden(
            "actor jurisdiction does not permit this action".to_string(),
        ));
    }
    Ok(())
}

pub fn authorize_transition_for_project(
    actor: &Actor,
    project: &Project,
    target: &ProjectStage,
) -> Result<(), ApiError> {
    authorize_transition(actor, target)?;
    if !jurisdiction_matches(actor, project) {
        return Err(ApiError::Forbidden(
            "actor jurisdiction does not permit access to this project".to_string(),
        ));
    }
    Ok(())
}

fn valid_transition_jurisdiction(actor: &Actor) -> bool {
    match (&actor.role, &actor.jurisdiction) {
        (
            Role::Admin | Role::LandRequiringBody | Role::GovernmentReviewer,
            Jurisdiction::National,
        ) => true,
        (Role::RevenueOfficer, Jurisdiction::State { .. }) => true,
        (
            Role::Collector
            | Role::AdditionalCollector
            | Role::GisOfficer
            | Role::SiaOfficer
            | Role::LegalOfficer
            | Role::FinanceOfficer
            | Role::RrOfficer,
            Jurisdiction::District { .. },
        ) => true,
        (Role::Collector | Role::RevenueOfficer, Jurisdiction::Field { .. }) => true,
        (Role::LandOwner, Jurisdiction::Public) => false,
        _ => true,
    }
}

fn hmac_sha256(secret: &[u8], message: &[u8]) -> [u8; 32] {
    let mut key = [0_u8; 64];
    if secret.len() > key.len() {
        key[..32].copy_from_slice(&Sha256::digest(secret));
    } else {
        key[..secret.len()].copy_from_slice(secret);
    }
    let mut inner_pad = [0x36_u8; 64];
    let mut outer_pad = [0x5c_u8; 64];
    for (index, key_byte) in key.iter().enumerate() {
        inner_pad[index] ^= key_byte;
        outer_pad[index] ^= key_byte;
    }
    let mut inner = Sha256::new();
    inner.update(inner_pad);
    inner.update(message);
    let inner_digest = inner.finalize();
    let mut outer = Sha256::new();
    outer.update(outer_pad);
    outer.update(inner_digest);
    outer.finalize().into()
}

fn constant_time_equal(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right)
        .fold(0_u8, |difference, (left, right)| {
            difference | (left ^ right)
        })
        == 0
}

fn encode_base64url(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut output = String::with_capacity((bytes.len() * 4).div_ceil(3));
    let mut index = 0;
    while index + 3 <= bytes.len() {
        let value = u32::from(bytes[index]) << 16
            | u32::from(bytes[index + 1]) << 8
            | u32::from(bytes[index + 2]);
        output.push(ALPHABET[((value >> 18) & 63) as usize] as char);
        output.push(ALPHABET[((value >> 12) & 63) as usize] as char);
        output.push(ALPHABET[((value >> 6) & 63) as usize] as char);
        output.push(ALPHABET[(value & 63) as usize] as char);
        index += 3;
    }
    let remaining = bytes.len() - index;
    if remaining == 1 {
        let value = u32::from(bytes[index]) << 16;
        output.push(ALPHABET[((value >> 18) & 63) as usize] as char);
        output.push(ALPHABET[((value >> 12) & 63) as usize] as char);
    } else if remaining == 2 {
        let value = u32::from(bytes[index]) << 16 | u32::from(bytes[index + 1]) << 8;
        output.push(ALPHABET[((value >> 18) & 63) as usize] as char);
        output.push(ALPHABET[((value >> 12) & 63) as usize] as char);
        output.push(ALPHABET[((value >> 6) & 63) as usize] as char);
    }
    output
}

fn decode_base64url(value: &str) -> Option<Vec<u8>> {
    let mut output = Vec::with_capacity(value.len() * 3 / 4);
    let mut accumulator = 0_u32;
    let mut bits = 0_u8;
    for byte in value.bytes() {
        let digit = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'-' => 62,
            b'_' => 63,
            _ => return None,
        };
        accumulator = (accumulator << 6) | u32::from(digit);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((accumulator >> bits) as u8);
            accumulator &= (1 << bits) - 1;
        }
    }
    if bits >= 6 {
        return None;
    }
    Some(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ehrms_employees_seeded() {
        let store = InMemoryStore::seeded();
        assert_eq!(store.ehrms_employees.len(), 10);

        let collector = store.ehrms_employees.get("EMP001").unwrap();
        assert_eq!(collector.name, "Raj Sharma");
        assert_eq!(collector.role, "COLLECTOR");
        assert_eq!(collector.designation, "Collector");

        let rev = store.ehrms_employees.get("EMP002").unwrap();
        assert_eq!(rev.name, "Amit Verma");
        assert_eq!(rev.role, "REVENUE_OFFICER");

        let gis = store.ehrms_employees.get("EMP003").unwrap();
        assert_eq!(gis.name, "Neha Singh");
        assert_eq!(gis.role, "GIS_OFFICER");

        let fin = store.ehrms_employees.get("EMP004").unwrap();
        assert_eq!(fin.name, "Ravi Kumar");
        assert_eq!(fin.role, "FINANCE_OFFICER");

        let rehab = store.ehrms_employees.get("EMP005").unwrap();
        assert_eq!(rehab.name, "Suresh Patel");
        assert_eq!(rehab.role, "REHABILITATION_OFFICER");

        let req = store.ehrms_employees.get("EMP006").unwrap();
        assert_eq!(req.name, "Praveen Singhal");
        assert_eq!(req.role, "LAND_REQUIRING_BODY");

        let sia = store.ehrms_employees.get("EMP007").unwrap();
        assert_eq!(sia.name, "Dr. Arvinder Roy");
        assert_eq!(sia.role, "SIA_OFFICER");

        let legal = store.ehrms_employees.get("EMP009").unwrap();
        assert_eq!(legal.name, "Adv. Madhav Joshi");
        assert_eq!(legal.role, "LEGAL_OFFICER");

        let gov = store.ehrms_employees.get("EMP010").unwrap();
        assert_eq!(gov.name, "Meenakshi Sundaram");
        assert_eq!(gov.role, "GOVERNMENT_REVIEWER");
    }

    #[test]
    fn test_statutory_workflow_stages_seeded() {
        let stages = sih_workflow::get_all_stage_definitions();
        assert_eq!(stages.len(), 15);
        assert_eq!(stages[0].stage_code, "proposal_initiation");
        assert_eq!(stages[14].stage_code, "project_closure");
        assert!(stages[14].is_terminal);

        let depts = sih_workflow::list_statutory_departments();
        assert_eq!(depts.len(), 10);

        let roles = sih_workflow::list_statutory_roles();
        assert_eq!(roles.len(), 11);
    }
}

