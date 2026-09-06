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
pub struct DashboardKpi {
    pub label: String,
    pub value: String,
    pub delta: String,
    pub tone: String,
    pub icon: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AlertNotice {
    pub label: String,
    pub title: String,
    pub detail: String,
    pub tone: String,
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

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StageGateDecisionRequest {
    pub user: String,
    #[serde(default = "default_approve")]
    pub decision: String,
    pub remarks: Option<String>,
    #[serde(default)]
    pub documents: Vec<String>,
}

fn default_approve() -> String {
    "APPROVE".to_string()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StageGateDecisionResponse {
    pub success: bool,
    pub message: String,
    pub previous_stage: ProjectStage,
    pub current_stage: ProjectStage,
    pub responsible_department: String,
    pub responsible_role: String,
    pub timeline_days: u32,
    pub deadline_at: Option<DateTime<Utc>>,
    pub actor: String,
    pub actor_role: String,
    pub decision: String,
    pub remarks: Option<String>,
    pub verified_documents: Vec<String>,
    pub audit_sequence: u64,
    pub audit_hash: String,
    pub workflow: WorkflowInstance,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkflowStatusResponse {
    pub workflow_id: Uuid,
    pub project_id: ProjectId,
    pub current_stage: ProjectStage,
    pub current_stage_name: String,
    pub responsible_department: String,
    pub responsible_role: String,
    pub approval_authority: String,
    pub timeline_days: u32,
    pub deadline_at: Option<DateTime<Utc>>,
    pub is_terminal: bool,
    pub required_documents: Vec<String>,
    pub uploaded_documents: Vec<String>,
    pub missing_documents: Vec<String>,
    pub can_advance: bool,
    pub recent_actions: Vec<ApprovalAction>,
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
    pub fn empty() -> Self {
        Self {
            projects: HashMap::new(),
            workflows: HashMap::new(),
            project_to_workflow: HashMap::new(),
            approval_history: HashMap::new(),
            audit_log: Vec::new(),
            objections: Vec::new(),
            rehabilitation: HashMap::new(),
            documents: Vec::new(),
            ehrms_employees: HashMap::new(),
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
        let in_memory = Arc::new(RwLock::new(InMemoryStore::empty()));

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

    pub async fn sync_from_db(&self) {
        let pool = match &self.pool {
            Some(p) => p,
            None => return,
        };

        if let Ok(projects) = self.project_repo.list_projects_async().await {
            let mut in_mem = self.in_memory.write().unwrap();
            for p in projects {
                in_mem.projects.insert(p.id, p);
            }
        }

        let rows = sqlx::query(
            "SELECT id, project_id, authority::text as authority, current_stage, started_at, 
                    notification_at, deadline_at, completed_at, lapsed_at
             FROM workflow_instance"
        )
        .fetch_all(pool)
        .await;

        if let Ok(rows) = rows {
            use sqlx::Row;
            let mut in_mem = self.in_memory.write().unwrap();
            for r in rows {
                let id: Uuid = r.try_get("id").unwrap_or_default();
                let project_id: Uuid = r.try_get("project_id").unwrap_or_default();
                let authority_str: String = r.try_get("authority").unwrap_or_else(|_| "larr".to_string());
                let authority = if authority_str == "national_highways" {
                    Authority::NationalHighways
                } else {
                    Authority::Larr
                };
                let stage_str: String = r.try_get("current_stage").unwrap_or_else(|_| "proposal_initiation".to_string());
                let current_stage = sih_workflow::db_code_to_stage(&stage_str);
                let handler = sih_workflow::who_handles_stage(&current_stage);

                let instance = WorkflowInstance {
                    id,
                    project_id,
                    authority,
                    current_stage,
                    started_at: r.try_get("started_at").unwrap_or_else(|_| Utc::now()),
                    notification_at: r.try_get("notification_at").ok(),
                    deadline_at: r.try_get("deadline_at").ok(),
                    completed_at: r.try_get("completed_at").ok(),
                    lapsed_at: r.try_get("lapsed_at").ok(),
                    responsible_department: Some(handler.department_code.to_string()),
                    responsible_role: Some(handler.role_code.to_string()),
                    stage_timeline_days: Some(handler.timeline_days),
                };

                in_mem.workflows.insert(id, instance);
                in_mem.project_to_workflow.insert(project_id, id);
            }
        }

        // Sync eHRMS users from DB
        if let Ok(users) = sqlx::query("SELECT id, employee_id, name, designation, department, role FROM users")
            .fetch_all(pool)
            .await
        {
            use sqlx::Row;
            let mut in_mem = self.in_memory.write().unwrap();
            for u in users {
                let id: Uuid = u.get("id");
                let eid: String = u.get("employee_id");
                in_mem.ehrms_employees.insert(
                    eid.clone(),
                    EhrmsEmployee {
                        id: id.to_string(),
                        employee_id: eid,
                        name: u.get("name"),
                        designation: u.get("designation"),
                        department: u.get("department"),
                        role: u.get("role"),
                    },
                );
            }
        }

        // Ensure genesis blocks in audit_log if empty
        use sqlx::Row;
        let audit_count: i64 = sqlx::query("SELECT count(*) FROM audit_log")
            .fetch_one(pool)
            .await
            .map(|r| r.get(0))
            .unwrap_or(0);

        if audit_count == 0 {
            let admin_id = Uuid::parse_str("00000000-0000-0000-0000-000000000010").unwrap();
            let p_id = Uuid::parse_str("00000000-0000-0000-0000-000000000100").unwrap();
            let _ = append_audit_log_pg(
                pool,
                Some(DEFAULT_TENANT_ID),
                Some(admin_id),
                Some("admin"),
                "GENESIS_INIT",
                "system",
                Some(DEFAULT_TENANT_ID),
                json!({"message": "LandFlow National Orchestration Layer Genesis Block"}),
                Some("System initialization under RFCTLARR Act 2013"),
            ).await;

            let _ = append_audit_log_pg(
                pool,
                Some(DEFAULT_TENANT_ID),
                Some(admin_id),
                Some("admin"),
                "CREATE_PROJECT",
                "project",
                Some(p_id),
                json!({"authority": "national_highways", "name": "Delhi-Mumbai Highway Expansion"}),
                Some("National corridor project registered"),
            ).await;
        }

        // Sync audit log from DB into memory cache
        if let Ok(entries) = sqlx::query(
            "SELECT id, occurred_at, actor_user_id, action, entity_type, entity_id, new_value, previous_hash, row_hash
             FROM audit_log
             ORDER BY id ASC"
        )
        .fetch_all(pool)
        .await
        {
            let mut in_mem = self.in_memory.write().unwrap();
            in_mem.audit_log.clear();
            for r in entries {
                let id: i64 = r.get("id");
                let occurred_at: DateTime<Utc> = r.get("occurred_at");
                let actor_user_id: Option<Uuid> = r.get("actor_user_id");
                let action: String = r.get("action");
                let entity_type: String = r.get("entity_type");
                let entity_id: Option<Uuid> = r.get("entity_id");
                let new_value: Option<serde_json::Value> = r.get("new_value");
                let previous_hash: String = r.get("previous_hash");
                let row_hash: String = r.get("row_hash");

                let resource = match entity_id {
                    Some(eid) => format!("{}/{}", entity_type, eid),
                    None => entity_type,
                };

                in_mem.audit_log.push(AuditEntry {
                    sequence: id as u64,
                    timestamp: occurred_at,
                    actor_id: actor_user_id.unwrap_or_default(),
                    action,
                    resource,
                    payload: new_value.unwrap_or_else(|| serde_json::json!({})),
                    previous_hash,
                    hash: row_hash,
                });
            }
        }

        // Sync documents from DB
        if let Ok(doc_rows) = sqlx::query(
            "SELECT id, project_id, kind, file_name, content_hash, version, coalesce(signed_by, '') as signed_by, created_at
             FROM document
             ORDER BY created_at ASC"
        )
        .fetch_all(pool)
        .await
        {
            let mut in_mem = self.in_memory.write().unwrap();
            in_mem.documents.clear();
            for r in doc_rows {
                in_mem.documents.push(DocumentRecord {
                    id: r.get("id"),
                    project_id: r.get("project_id"),
                    kind: r.get("kind"),
                    file_name: r.get("file_name"),
                    content_hash: r.get("content_hash"),
                    version: r.get::<i32, _>("version") as u32,
                    signed_by: r.get("signed_by"),
                    uploaded_at: r.get("created_at"),
                });
            }
        }

        // Sync objections from DB
        if let Ok(obj_rows) = sqlx::query(
            "SELECT id, project_id, coalesce(survey_number, '') as survey_number,
                    coalesce(owner_name, '') as owner_name, coalesce(objection_type, 'general') as objection_type,
                    coalesce(description, text) as text, status, filed_at, resolution
             FROM objection
             ORDER BY filed_at ASC"
        )
        .fetch_all(pool)
        .await
        {
            let mut in_mem = self.in_memory.write().unwrap();
            in_mem.objections.clear();
            for r in obj_rows {
                let pid: Option<Uuid> = r.get("project_id");
                if let Some(project_id) = pid {
                    in_mem.objections.push(ObjectionRecord {
                        id: r.get("id"),
                        project_id,
                        survey_number: r.get("survey_number"),
                        owner_name: r.get("owner_name"),
                        objection_type: r.get("objection_type"),
                        text: r.get("text"),
                        status: r.get("status"),
                        filed_at: r.get("filed_at"),
                        resolution: r.get("resolution"),
                    });
                }
            }
        }
    }
}

pub async fn append_audit_log_pg(
    pool: &DbPool,
    tenant_id: Option<Uuid>,
    actor_id: Option<Uuid>,
    actor_role: Option<&str>,
    action: &str,
    entity_type: &str,
    entity_id: Option<Uuid>,
    payload: serde_json::Value,
    reason: Option<&str>,
) -> Result<AuditEntry, ApiError> {
    use sqlx::Row;
    let last_row = sqlx::query("SELECT id, row_hash FROM audit_log ORDER BY id DESC LIMIT 1")
        .fetch_optional(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to read audit_log: {e}")))?;

    let (prev_hash, seq) = match last_row {
        Some(r) => {
            let h: String = r.get("row_hash");
            let id: i64 = r.get("id");
            (h, (id as u64) + 1)
        }
        None => (String::new(), 1u64),
    };

    let now_micros = Utc::now().timestamp_micros();
    let timestamp = chrono::DateTime::from_timestamp_micros(now_micros).unwrap_or_else(Utc::now);

    let resource = match entity_id {
        Some(eid) => format!("{}/{}", entity_type, eid),
        None => entity_type.to_string(),
    };

    let canonical = format!(
        "{}|{}|{}|{}|{}|{}|{}",
        seq,
        timestamp.to_rfc3339(),
        actor_id.unwrap_or_default(),
        action,
        resource,
        payload,
        prev_hash
    );
    let row_hash = format!("{:x}", sha2::Sha256::digest(canonical.as_bytes()));

    let inserted_id = sqlx::query(
        "INSERT INTO audit_log (
            occurred_at, tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, new_value, reason, previous_hash, row_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id"
    )
    .bind(timestamp)
    .bind(tenant_id)
    .bind(actor_id)
    .bind(actor_role)
    .bind(action)
    .bind(entity_type)
    .bind(entity_id)
    .bind(&payload)
    .bind(reason)
    .bind(&prev_hash)
    .bind(&row_hash)
    .fetch_one(pool)
    .await
    .map_err(|e| ApiError::BadRequest(format!("Failed to insert audit_log: {e}")))?
    .get::<i64, _>("id");

    Ok(AuditEntry {
        sequence: inserted_id as u64,
        timestamp,
        actor_id: actor_id.unwrap_or_default(),
        action: action.to_string(),
        resource,
        payload,
        previous_hash: prev_hash,
        hash: row_hash,
    })
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
        .route("/workflow/:id/approve", post(approve_workflow_endpoint))
        .route("/workflow/:id/reject", post(reject_workflow_endpoint))
        .route("/workflow/:id/history", get(workflow_history))
        .route("/workflow/:id/status", get(get_workflow_status))
        .route("/workflow/my-tasks/:role", get(get_my_tasks))
        .route("/workflow/my-tasks", get(get_my_tasks_authenticated))
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
        .route("/dashboard/kpis", get(get_dashboard_kpis))
        .route("/alerts", get(get_alerts))
        .route("/parcels/:id/ownership", get(get_parcel_ownership))
        .route("/parcels/:id/ownership", post(set_parcel_ownership))
        .route("/deposits/parcel/:id", get(list_deposits_for_parcel))
        .route("/deposits", post(create_deposit_with_authority))
        .route("/deposits/:id/release", post(release_deposit))
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

    // Always update in-memory store. Scope the write lock so it is released
    // before the audit-log append below — std::sync::RwLockWriteGuard is !Send
    // and cannot be held across the .await on append_audit_entry_db_and_mem
    // (which itself takes the write lock internally to update the read cache).
    {
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
    }

    // Cryptographic audit log entry. previous_hash is read FROM THE DATABASE
    // via append_audit_entry_db_and_mem (source of truth for the hash chain),
    // NOT from the in-memory audit_log Vec (which is only a read cache for
    // /audit/trail and may be empty after a restart with a populated DB).
    let _ = append_audit_entry_db_and_mem(
        &state,
        0,
        actor.id,
        "CREATE_PROJECT",
        "project",
        project.id,
        json!({"name": project.name, "authority": format!("{:?}", project.authority)}),
    )
    .await;

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

    // Scope the in-memory write lock so it is released before the audit-log
    // append below (see create_project for the rationale — same !Send guard
    // cannot be held across .await).
    {
        let mut in_mem = state.in_memory.write().unwrap();
        if let Some(p) = in_mem.projects.get_mut(&project_id) {
            p.parcels.push(parcel.clone());
            p.updated_at = Utc::now();
        }
    }

    // previous_hash is read FROM THE DATABASE via append_audit_entry_db_and_mem
    // (source of truth for the hash chain), not from the in-memory Vec.
    let _ = append_audit_entry_db_and_mem(
        &state,
        0,
        actor.id,
        "ADD_PARCEL",
        "parcel",
        parcel.id,
        json!({"project_id": project_id, "survey_number": parcel.survey_number, "area": parcel.area_hectares}),
    )
    .await;

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

    // Scope the in-memory write lock so it is released before the audit-log
    // append below (see create_project for the rationale — same !Send guard
    // cannot be held across .await).
    {
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
    }

    // previous_hash is read FROM THE DATABASE via append_audit_entry_db_and_mem
    // (source of truth for the hash chain), not from the in-memory Vec.
    let _ = append_audit_entry_db_and_mem(
        &state,
        0,
        actor.id,
        "TRANSITION_STAGE",
        "project",
        project.id,
        json!({"to_stage": format!("{:?}", project.stage)}),
    )
    .await;

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

    // Scope the in-memory write lock so it is released before the audit-log
    // append below (see create_project for the rationale — same !Send guard
    // cannot be held across .await). The variables needed to construct the
    // audit payload (instance_clone, from, to, project_id, next_handler) are
    // all Copy or cheaply Cloned out of the block.
    let (instance_clone, from, to, project_id, next_handler) = {
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

        (instance_clone, from, to, project_id, next_handler)
    };

    // previous_hash is read FROM THE DATABASE via append_audit_entry_db_and_mem
    // (source of truth for the hash chain), not from the in-memory Vec.
    let _ = append_audit_entry_db_and_mem(
        &state,
        0,
        actor.id,
        "WORKFLOW_ADVANCE",
        "workflow",
        workflow_id,
        json!({
            "from": format!("{:?}", from),
            "to": format!("{:?}", to),
            "department": next_handler.department_code,
            "role": next_handler.role_code,
            "timeline_days": next_handler.timeline_days,
            "approval_authority": next_handler.approval_authority,
        }),
    )
    .await;

    Ok(Json(instance_clone))
}

fn resolve_workflow_instance(
    in_mem: &InMemoryStore,
    id_str: &str,
) -> Result<Uuid, ApiError> {
    if let Ok(u) = Uuid::parse_str(id_str) {
        if in_mem.workflows.contains_key(&u) {
            return Ok(u);
        }
        if let Some(&w_id) = in_mem.project_to_workflow.get(&u) {
            return Ok(w_id);
        }
    }
    for (p_id, &w_id) in &in_mem.project_to_workflow {
        if p_id.to_string().eq_ignore_ascii_case(id_str) {
            return Ok(w_id);
        }
        if let Some(p) = in_mem.projects.get(p_id) {
            if p.name.to_lowercase().contains(&id_str.to_lowercase()) {
                return Ok(w_id);
            }
        }
    }
    if let Some(&w_id) = in_mem.workflows.keys().next() {
        if id_str == "default" || id_str == "active" || id_str == "current" {
            return Ok(w_id);
        }
    }
    Err(ApiError::NotFound(format!("Workflow instance not found for ID '{}'", id_str)))
}

fn resolve_actor_details(
    in_mem: &InMemoryStore,
    user_str: &str,
) -> (String, String, String) {
    let clean = user_str.trim().to_uppercase();
    if let Some(emp) = in_mem.ehrms_employees.get(&clean) {
        return (emp.name.clone(), emp.role.clone(), emp.department.clone());
    }
    for emp in in_mem.ehrms_employees.values() {
        if emp.role.to_uppercase() == clean
            || emp.designation.to_uppercase() == clean
            || emp.name.to_uppercase().contains(&clean)
        {
            return (emp.name.clone(), emp.role.clone(), emp.department.clone());
        }
    }
    if clean.contains("CITIZEN") || clean.contains("OWNER") || clean.contains("LAND") {
        return (
            "Suresh Kumar / Meera Devi (Citizen Landowner)".to_string(),
            "LAND_OWNER".to_string(),
            "Public Transparency Desk".to_string(),
        );
    }
    (
        user_str.to_string(),
        "COLLECTOR".to_string(),
        "District Administration".to_string(),
    )
}

fn is_role_authorized(actor_role: &str, responsible_role: &str) -> bool {
    let a = actor_role.to_uppercase().replace(['_', '-'], " ");
    let r = responsible_role.to_uppercase().replace(['_', '-'], " ");
    if a.contains(&r) || r.contains(&a) {
        return true;
    }
    // Executive oversight roles (Collector, Administration, Government Reviewer)
    if a.contains("COLLECTOR") || a.contains("ADMIN") || a.contains("GOVERNMENT REVIEWER") {
        return true;
    }
    false
}

fn check_mandatory_documents(
    required_docs: &[&'static str],
    submitted_docs: &[String],
    project_docs: &[DocumentRecord],
) -> Vec<&'static str> {
    let mut missing = Vec::new();
    for &req in required_docs {
        let req_norm = req.to_lowercase().replace(['_', '-', ' ', '(', ')', '/', '.'], "");
        let present = submitted_docs.iter().any(|d| {
            let d_norm = d.to_lowercase().replace(['_', '-', ' ', '(', ')', '/', '.'], "");
            d_norm.contains(&req_norm) || req_norm.contains(&d_norm)
        }) || project_docs.iter().any(|p| {
            let k_norm = p.kind.to_lowercase().replace(['_', '-', ' ', '(', ')', '/', '.'], "");
            let f_norm = p.file_name.to_lowercase().replace(['_', '-', ' ', '(', ')', '/', '.'], "");
            k_norm.contains(&req_norm) || req_norm.contains(&k_norm) || f_norm.contains(&req_norm)
        });
        if !present {
            missing.push(req);
        }
    }
    missing
}

fn next_statutory_stage(current: &ProjectStage) -> Option<ProjectStage> {
    match current {
        ProjectStage::ProposalInitiation | ProjectStage::Draft => Some(ProjectStage::LandRecordVerification),
        ProjectStage::LandRecordVerification | ProjectStage::Survey => Some(ProjectStage::SiaPreparation),
        ProjectStage::SiaPreparation => Some(ProjectStage::SiaReview),
        ProjectStage::SiaReview => Some(ProjectStage::PreliminaryNotification),
        ProjectStage::PreliminaryNotification => Some(ProjectStage::ObjectionPeriod),
        ProjectStage::ObjectionPeriod | ProjectStage::PublicHearing => Some(ProjectStage::Hearing),
        ProjectStage::Hearing => Some(ProjectStage::Declaration),
        ProjectStage::Declaration | ProjectStage::Sanctioned => Some(ProjectStage::AwardPreparation),
        ProjectStage::AwardPreparation => Some(ProjectStage::AwardApproval),
        ProjectStage::AwardApproval | ProjectStage::CompensationAward => Some(ProjectStage::CompensationCalculation),
        ProjectStage::CompensationCalculation => Some(ProjectStage::PaymentProcessing),
        ProjectStage::PaymentProcessing | ProjectStage::FundsDisbursed => Some(ProjectStage::Possession),
        ProjectStage::Possession => Some(ProjectStage::RrCompletion),
        ProjectStage::RrCompletion | ProjectStage::RrScheme => Some(ProjectStage::ProjectClosure),
        ProjectStage::ProjectClosure | ProjectStage::Completed => None,
        ProjectStage::Lapsed => None,
    }
}

fn previous_statutory_stage(current: &ProjectStage) -> ProjectStage {
    match current {
        ProjectStage::LandRecordVerification | ProjectStage::Survey => ProjectStage::ProposalInitiation,
        ProjectStage::SiaPreparation => ProjectStage::LandRecordVerification,
        ProjectStage::SiaReview => ProjectStage::SiaPreparation,
        ProjectStage::PreliminaryNotification => ProjectStage::SiaReview,
        ProjectStage::ObjectionPeriod => ProjectStage::PreliminaryNotification,
        ProjectStage::Hearing => ProjectStage::ObjectionPeriod,
        ProjectStage::Declaration => ProjectStage::Hearing,
        ProjectStage::AwardPreparation => ProjectStage::Declaration,
        ProjectStage::AwardApproval => ProjectStage::AwardPreparation,
        ProjectStage::CompensationCalculation => ProjectStage::AwardApproval,
        ProjectStage::PaymentProcessing => ProjectStage::CompensationCalculation,
        ProjectStage::Possession => ProjectStage::PaymentProcessing,
        ProjectStage::RrCompletion => ProjectStage::Possession,
        ProjectStage::ProjectClosure => ProjectStage::RrCompletion,
        _ => ProjectStage::ProposalInitiation,
    }
}

async fn approve_workflow_endpoint(
    State(state): State<AppState>,
    Path(id_str): Path<String>,
    JsonBody(request): JsonBody<StageGateDecisionRequest>,
) -> Result<Json<StageGateDecisionResponse>, ApiError> {
    let now = Utc::now();

    // ============================================================
    // PHASE 1 (read-only, no lock): resolve workflow_id + project_id +
    // current_stage + next_stage so we can run the timeline gate checks.
    // This avoids holding the in_mem write lock across DB awaits.
    // ============================================================
    let (workflow_id, project_id, current_stage, next_stage) = {
        let in_mem = state.in_memory.read().unwrap();
        let workflow_id = resolve_workflow_instance(&in_mem, &id_str)?;
        let instance = in_mem
            .workflows
            .get(&workflow_id)
            .ok_or_else(|| ApiError::NotFound(format!("Workflow not found for ID '{}'", workflow_id)))?;
        let project_id = instance.project_id;
        let current_stage = instance.current_stage;
        let next_stage = next_statutory_stage(&current_stage).unwrap_or(ProjectStage::ProjectClosure);
        (workflow_id, project_id, current_stage, next_stage)
    };

    // ============================================================
    // PHASE 2: STATUTORY TIMELINE GATE (Master PDF §22, §36)
    // Enforces:
    //   - §22.2 60-day LARR / 21-day NH objection window must close
    //     before ObjectionPeriod → Hearing
    //   - §22.3 Declaration within 12 months of Section 11
    //   - §22.6 80% compensation paid before Possession (Section 38)
    //   - §36   Active court stay blocks all transitions
    // Runs BEFORE acquiring the write lock so DB awaits don't deadlock.
    // ============================================================
    {
        let project = {
            let in_mem = state.in_memory.read().unwrap();
            in_mem.projects.get(&project_id).cloned()
        };
        if let Some(project) = project {
            // Pull active court stays from the litigation_case table if we
            // have a DB pool. Falls back to empty slice (no stays) when DB
            // is unavailable — preserves the no-DB demo-mode behavior.
            let stays: Vec<(DateTime<Utc>, DateTime<Utc>)> = if let Some(ref pool) = state.pool {
                sqlx::query(
                    "SELECT stay_from, stay_to FROM litigation_case
                     WHERE project_id = $1
                       AND status = 'stayed'
                       AND stay_from IS NOT NULL
                       AND stay_to IS NOT NULL"
                )
                .bind(project_id)
                .fetch_all(pool)
                .await
                .unwrap_or_default()
                .into_iter()
                .map(|r| {
                    use sqlx::Row;
                    let from: DateTime<Utc> = r.try_get("stay_from").unwrap_or_else(|_| Utc::now());
                    let to: DateTime<Utc> = r.try_get("stay_to").unwrap_or_else(|_| Utc::now() + chrono::Duration::days(365));
                    (from, to)
                })
                .collect()
            } else {
                Vec::new()
            };

            // Pull compensation totals from award + payment tables for the
            // §22.6 80% gate. None = fail open (MVP behavior).
            let (paid_paise, awarded_paise): (Option<i64>, Option<i64>) = if let Some(ref pool) = state.pool {
                let awarded: Option<i64> = sqlx::query(
                    "SELECT coalesce(sum(total_paise), 0)::bigint FROM award WHERE project_id = $1"
                )
                .bind(project_id)
                .fetch_one(pool)
                .await
                .ok()
                .map(|r| { use sqlx::Row; r.try_get::<i64, _>(0).unwrap_or(0) });

                let paid: Option<i64> = sqlx::query(
                    "SELECT coalesce(sum(p.amount_paise), 0)::bigint
                     FROM payment p
                     JOIN award a ON p.award_id = a.id
                     WHERE a.project_id = $1 AND p.status = 'paid'"
                )
                .bind(project_id)
                .fetch_one(pool)
                .await
                .ok()
                .map(|r| { use sqlx::Row; r.try_get::<i64, _>(0).unwrap_or(0) });

                (paid, awarded)
            } else {
                (None, None)
            };

            if let Err(gate_failure) = sih_workflow::check_timeline_gates(
                &project,
                &next_stage,
                now,
                &stays,
                paid_paise,
                awarded_paise,
            ) {
                return Err(ApiError::BadRequest(format!(
                    "Timeline gate failed ({}): {}",
                    gate_failure.code, gate_failure.message
                )));
            }
        }
    }

    // ============================================================
    // PHASE 3 (write lock): role authorization + document check +
    // stage mutation + DB persistence. Audit log is appended AFTER
    // the lock is released — see Task E notes in append_audit_entry_db_and_mem.
    // ============================================================
    let (
        next_handler,
        actor_name,
        actor_role,
        actor_dept,
        stage_deadline,
        updated_instance,
    ) = {
        let mut in_mem = state.in_memory.write().unwrap();

        let handler = sih_workflow::who_handles_stage(&current_stage);
        let (actor_name, actor_role, actor_dept) = resolve_actor_details(&in_mem, &request.user);

        // Verify role authorization
        if !is_role_authorized(&actor_role, handler.role_name) {
            return Err(ApiError::Forbidden(format!(
                "User '{}' with role '{}' is not authorized to approve stage '{}'. Responsible role is '{}' ({})",
                request.user, actor_role, sih_workflow::canonical_stage_label(&current_stage), handler.role_name, handler.department_name
            )));
        }

        // Verify mandatory documents
        let project_docs: Vec<DocumentRecord> = in_mem
            .documents
            .iter()
            .filter(|d| d.project_id == project_id)
            .cloned()
            .collect();
        let missing = check_mandatory_documents(
            handler.required_documents,
            &request.documents,
            &project_docs,
        );
        if !missing.is_empty() {
            return Err(ApiError::BadRequest(format!(
                "Cannot approve stage '{}': missing {} mandatory statutory document(s): [{}]. All required documents under RFCTLARR Act 2013 must be verified and uploaded.",
                sih_workflow::canonical_stage_label(&current_stage),
                missing.len(),
                missing.join(", ")
            )));
        }

        let next_handler = sih_workflow::who_handles_stage(&next_stage);
        let stage_deadline = Some(now + chrono::Duration::days(next_handler.timeline_days as i64));

        // Persist verified documents to project
        for doc_name in &request.documents {
            let already = in_mem
                .documents
                .iter()
                .any(|d| d.project_id == project_id && d.file_name.eq_ignore_ascii_case(doc_name));
            if !already {
                let doc_hash = format!("sha256-doc-{:x}", (doc_name.len() * 37 + 101));
                in_mem.documents.push(DocumentRecord {
                    id: Uuid::new_v4(),
                    project_id,
                    kind: format!("{:?}", current_stage),
                    file_name: doc_name.clone(),
                    content_hash: doc_hash,
                    version: 1,
                    signed_by: format!("{} ({})", actor_name, actor_role),
                    uploaded_at: now,
                });
            }
        }

        let updated_instance = {
            let instance = in_mem
                .workflows
                .get_mut(&workflow_id)
                .ok_or_else(|| ApiError::NotFound("workflow not found".to_string()))?;

            instance.current_stage = next_stage;
            instance.deadline_at = stage_deadline;
            instance.responsible_department = Some(next_handler.department_code.to_string());
            instance.responsible_role = Some(next_handler.role_code.to_string());
            instance.stage_timeline_days = Some(next_handler.timeline_days);

            if next_stage == ProjectStage::PreliminaryNotification {
                instance.notification_at = Some(now);
            }
            if next_stage == ProjectStage::ProjectClosure || next_stage == ProjectStage::Completed {
                instance.completed_at = Some(now);
            }
            instance.clone()
        };

        if let Some(p) = in_mem.projects.get_mut(&project_id) {
            p.stage = next_stage;
            p.updated_at = now;
            if next_stage == ProjectStage::PreliminaryNotification {
                p.preliminary_notification_at = Some(now);
            }
        }

        let action = ApprovalAction {
            id: Uuid::new_v4(),
            workflow_instance_id: workflow_id,
            from_stage: current_stage,
            to_stage: next_stage,
            actor_user_id: None,
            actor_role: sih_domain::Role::Admin,
            decision: "APPROVED".to_string(),
            reason: request.remarks.clone(),
            created_at: now,
        };
        in_mem
            .approval_history
            .entry(workflow_id)
            .or_default()
            .push(action);

        (
            next_handler,
            actor_name,
            actor_role,
            actor_dept,
            stage_deadline,
            updated_instance,
        )
    };

    // Audit log: previous_hash is read FROM THE DATABASE via
    // append_audit_entry_db_and_mem (source of truth for the hash chain),
    // not from the in-memory Vec. The helper writes to BOTH the DB and the
    // in-mem read cache, replacing the previous duplicate-write pattern
    // (buggy in-mem push + append_audit_log_pg) that left the in-mem cache
    // with a stale previous_hash inconsistent with the DB row.
    let audit_payload = json!({
        "from_stage": sih_workflow::canonical_stage_label(&current_stage),
        "to_stage": sih_workflow::canonical_stage_label(&next_stage),
        "actor": actor_name,
        "role": actor_role,
        "department": actor_dept,
        "decision": "APPROVE",
        "remarks": request.remarks,
        "verified_documents": request.documents,
        "next_responsible_dept": next_handler.department_code,
        "next_responsible_role": next_handler.role_code,
        "sla_deadline": stage_deadline,
    });
    let (seq, audit_hash) = match append_audit_entry_db_and_mem(
        &state,
        0,
        project_id,
        "STAGE_GATE_APPROVAL",
        "workflow",
        workflow_id,
        audit_payload,
    )
    .await
    {
        Ok((s, h)) => (s, h),
        Err(_) => (0u64, String::new()),
    };

    if let Some(ref pool) = state.pool {
        let stage_code = sih_workflow::stage_to_db_code(next_stage);
        let _ = sqlx::query(
            "UPDATE workflow_instance SET current_stage = $1, deadline_at = $2, notification_at = $3, completed_at = $4 WHERE id = $5"
        )
        .bind(stage_code)
        .bind(stage_deadline)
        .bind(if next_stage == ProjectStage::PreliminaryNotification { Some(now) } else { None })
        .bind(if next_stage == ProjectStage::ProjectClosure || next_stage == ProjectStage::Completed { Some(now) } else { None })
        .bind(workflow_id)
        .execute(pool)
        .await;

        let proj_status = sih_domain::repository::map_stage_to_db_status(next_stage);
        let _ = sqlx::query(
            "UPDATE project SET status = $1::project_status, updated_at = $2 WHERE id = $3"
        )
        .bind(proj_status)
        .bind(now)
        .bind(project_id)
        .execute(pool)
        .await;

        let from_code = sih_workflow::stage_to_db_code(current_stage);
        let _ = sqlx::query(
            "INSERT INTO approval_history (workflow_instance_id, from_stage, to_stage, actor_role, decision, reason, created_at)
             VALUES ($1, $2, $3, $4, 'approved', $5, $6)"
        )
        .bind(workflow_id)
        .bind(from_code)
        .bind(stage_code)
        .bind(&actor_role)
        .bind(&request.remarks)
        .bind(now)
        .execute(pool)
        .await;

        // NOTE: the previous append_audit_log_pg call has been removed — the
        // append_audit_entry_db_and_mem call above already inserted the audit_log
        // row (with previous_hash sourced from the DB) and updated the in-mem
        // cache. Calling append_audit_log_pg here would have created a DUPLICATE
        // audit_log row, breaking the chain.
    }

    Ok(Json(StageGateDecisionResponse {
        success: true,
        message: format!(
            "Stage advanced from '{}' to '{}'. Handed over to {} ({}) with {} days SLA.",
            sih_workflow::canonical_stage_label(&current_stage),
            sih_workflow::canonical_stage_label(&next_stage),
            next_handler.role_code,
            next_handler.department_code,
            next_handler.timeline_days
        ),
        previous_stage: current_stage,
        current_stage: next_stage,
        responsible_department: next_handler.department_code.to_string(),
        responsible_role: next_handler.role_code.to_string(),
        timeline_days: next_handler.timeline_days,
        deadline_at: stage_deadline,
        actor: actor_name,
        actor_role,
        decision: "APPROVE".to_string(),
        remarks: request.remarks,
        verified_documents: request.documents,
        audit_sequence: seq,
        audit_hash,
        workflow: updated_instance,
    }))
}

async fn reject_workflow_endpoint(
    State(state): State<AppState>,
    Path(id_str): Path<String>,
    JsonBody(body_val): JsonBody<serde_json::Value>,
) -> Result<Json<StageGateDecisionResponse>, ApiError> {
    let now = Utc::now();
    let user = body_val.get("user").and_then(|v| v.as_str()).unwrap_or("EMP001");
    let remarks = body_val
        .get("remarks")
        .and_then(|v| v.as_str())
        .or_else(|| body_val.get("reason").and_then(|v| v.as_str()))
        .map(|s| s.to_string());

    // Scope the in-memory write lock so it is released before the audit-log
    // append below — see Task E notes in append_audit_entry_db_and_mem.
    let (
        workflow_id,
        project_id,
        current_stage,
        prev_stage,
        prev_handler,
        actor_name,
        actor_role,
        actor_dept,
        stage_deadline,
        updated_instance,
    ) = {
        let mut in_mem = state.in_memory.write().unwrap();
        let workflow_id = resolve_workflow_instance(&in_mem, &id_str)?;

        let (project_id, current_stage) = {
            let instance = in_mem
                .workflows
                .get(&workflow_id)
                .ok_or_else(|| ApiError::NotFound(format!("Workflow not found for ID '{}'", workflow_id)))?;
            (instance.project_id, instance.current_stage)
        };

        let prev_stage = previous_statutory_stage(&current_stage);
        let prev_handler = sih_workflow::who_handles_stage(&prev_stage);
        let (actor_name, actor_role, actor_dept) = resolve_actor_details(&in_mem, user);
        let stage_deadline = Some(now + chrono::Duration::days(prev_handler.timeline_days as i64));

        let updated_instance = {
            let instance = in_mem
                .workflows
                .get_mut(&workflow_id)
                .ok_or_else(|| ApiError::NotFound("workflow not found".to_string()))?;

            instance.current_stage = prev_stage;
            instance.deadline_at = stage_deadline;
            instance.responsible_department = Some(prev_handler.department_code.to_string());
            instance.responsible_role = Some(prev_handler.role_code.to_string());
            instance.stage_timeline_days = Some(prev_handler.timeline_days);
            instance.clone()
        };

        if let Some(p) = in_mem.projects.get_mut(&project_id) {
            p.stage = prev_stage;
            p.updated_at = now;
        }

        let action = ApprovalAction {
            id: Uuid::new_v4(),
            workflow_instance_id: workflow_id,
            from_stage: current_stage,
            to_stage: prev_stage,
            actor_user_id: None,
            actor_role: sih_domain::Role::Admin,
            decision: "REJECTED".to_string(),
            reason: remarks.clone(),
            created_at: now,
        };
        in_mem
            .approval_history
            .entry(workflow_id)
            .or_default()
            .push(action);

        (
            workflow_id,
            project_id,
            current_stage,
            prev_stage,
            prev_handler,
            actor_name,
            actor_role,
            actor_dept,
            stage_deadline,
            updated_instance,
        )
    };

    // Audit log: previous_hash is read FROM THE DATABASE via
    // append_audit_entry_db_and_mem (source of truth for the hash chain),
    // not from the in-memory Vec. The helper writes to BOTH the DB and the
    // in-mem read cache, replacing the previous duplicate-write pattern
    // (buggy in-mem push + append_audit_log_pg) that left the in-mem cache
    // with a stale previous_hash inconsistent with the DB row.
    let audit_payload = json!({
        "from_stage": sih_workflow::canonical_stage_label(&current_stage),
        "returned_to": sih_workflow::canonical_stage_label(&prev_stage),
        "actor": actor_name,
        "role": actor_role,
        "department": actor_dept,
        "decision": "REJECT",
        "remarks": remarks,
        "responsible_dept": prev_handler.department_code,
        "responsible_role": prev_handler.role_code,
        "sla_deadline": stage_deadline,
    });
    let (seq, audit_hash) = match append_audit_entry_db_and_mem(
        &state,
        0,
        project_id,
        "STAGE_GATE_REJECTION",
        "workflow",
        workflow_id,
        audit_payload,
    )
    .await
    {
        Ok((s, h)) => (s, h),
        Err(_) => (0u64, String::new()),
    };

    if let Some(ref pool) = state.pool {
        let stage_code = sih_workflow::stage_to_db_code(prev_stage);
        let _ = sqlx::query(
            "UPDATE workflow_instance SET current_stage = $1, deadline_at = $2 WHERE id = $3"
        )
        .bind(stage_code)
        .bind(stage_deadline)
        .bind(workflow_id)
        .execute(pool)
        .await;

        let proj_status = sih_domain::repository::map_stage_to_db_status(prev_stage);
        let _ = sqlx::query(
            "UPDATE project SET status = $1::project_status, updated_at = $2 WHERE id = $3"
        )
        .bind(proj_status)
        .bind(now)
        .bind(project_id)
        .execute(pool)
        .await;

        let from_code = sih_workflow::stage_to_db_code(current_stage);
        let _ = sqlx::query(
            "INSERT INTO approval_history (workflow_instance_id, from_stage, to_stage, actor_role, decision, reason, created_at)
             VALUES ($1, $2, $3, $4, 'rejected', $5, $6)"
        )
        .bind(workflow_id)
        .bind(from_code)
        .bind(stage_code)
        .bind(&actor_role)
        .bind(&remarks)
        .bind(now)
        .execute(pool)
        .await;

        // NOTE: the previous append_audit_log_pg call has been removed — the
        // append_audit_entry_db_and_mem call above already inserted the audit_log
        // row (with previous_hash sourced from the DB) and updated the in-mem
        // cache. Calling append_audit_log_pg here would have created a DUPLICATE
        // audit_log row, breaking the chain.
    }

    Ok(Json(StageGateDecisionResponse {
        success: true,
        message: format!(
            "Stage rejected from '{}' and returned to '{}' for revision. Assigned to {} ({}).",
            sih_workflow::canonical_stage_label(&current_stage),
            sih_workflow::canonical_stage_label(&prev_stage),
            prev_handler.role_code,
            prev_handler.department_code
        ),
        previous_stage: current_stage,
        current_stage: prev_stage,
        responsible_department: prev_handler.department_code.to_string(),
        responsible_role: prev_handler.role_code.to_string(),
        timeline_days: prev_handler.timeline_days,
        deadline_at: stage_deadline,
        actor: actor_name,
        actor_role,
        decision: "REJECT".to_string(),
        remarks,
        verified_documents: vec![],
        audit_sequence: seq,
        audit_hash,
        workflow: updated_instance,
    }))
}

async fn get_workflow_status(
    State(state): State<AppState>,
    Path(id_str): Path<String>,
) -> Result<Json<WorkflowStatusResponse>, ApiError> {
    if let Some(ref pool) = state.pool {
        let parsed_uuid = Uuid::parse_str(&id_str).ok();
        use sqlx::Row;
        let row = if let Some(uid) = parsed_uuid {
            sqlx::query(
                "SELECT id, project_id, authority::text as authority, current_stage, started_at, 
                        notification_at, deadline_at, completed_at, lapsed_at
                 FROM workflow_instance
                 WHERE id = $1 OR project_id = $1"
            )
            .bind(uid)
            .fetch_optional(pool)
            .await
            .map_err(|e| ApiError::BadRequest(format!("Failed to query workflow_instance: {e}")))?
        } else {
            None
        };

        let row = match row {
            Some(r) => r,
            None => sqlx::query(
                "SELECT id, project_id, authority::text as authority, current_stage, started_at, 
                        notification_at, deadline_at, completed_at, lapsed_at
                 FROM workflow_instance
                 LIMIT 1"
            )
            .fetch_one(pool)
            .await
            .map_err(|_| ApiError::NotFound(format!("Workflow not found for ID '{id_str}'")))?,
        };

        let workflow_id: Uuid = row.get("id");
        let project_id: Uuid = row.get("project_id");
        let stage_str: String = row.get("current_stage");
        let deadline_at: Option<DateTime<Utc>> = row.get("deadline_at");

        let current_stage = sih_workflow::db_code_to_stage(&stage_str);
        let handler = sih_workflow::who_handles_stage(&current_stage);

        let doc_rows = sqlx::query("SELECT file_name FROM document WHERE project_id = $1")
            .bind(project_id)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

        let uploaded_names: Vec<String> = doc_rows.iter().map(|r| r.get("file_name")).collect();

        let fake_docs: Vec<DocumentRecord> = uploaded_names
            .iter()
            .map(|name| DocumentRecord {
                id: Uuid::nil(),
                project_id,
                kind: String::new(),
                file_name: name.clone(),
                content_hash: String::new(),
                version: 1,
                signed_by: String::new(),
                uploaded_at: Utc::now(),
            })
            .collect();

        let missing = check_mandatory_documents(
            handler.required_documents,
            &[],
            &fake_docs,
        );
        let missing_names: Vec<String> = missing.iter().map(|s| s.to_string()).collect();

        let hist_rows = sqlx::query(
            "SELECT from_stage, to_stage, actor_role, decision, reason, created_at
             FROM approval_history
             WHERE workflow_instance_id = $1
             ORDER BY created_at ASC"
        )
        .bind(workflow_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        let mut recent_actions = Vec::new();
        for hr in hist_rows {
            let from_s: String = hr.get("from_stage");
            let to_s: String = hr.get("to_stage");
            let _role_s: String = hr.get("actor_role");
            let dec_s: String = hr.get("decision");
            let reason: Option<String> = hr.get("reason");
            let created_at: DateTime<Utc> = hr.get("created_at");

            recent_actions.push(ApprovalAction {
                id: Uuid::nil(),
                workflow_instance_id: workflow_id,
                from_stage: sih_workflow::db_code_to_stage(&from_s),
                to_stage: sih_workflow::db_code_to_stage(&to_s),
                actor_user_id: None,
                actor_role: sih_domain::Role::Admin,
                decision: dec_s,
                reason,
                created_at,
            });
        }

        let is_terminal = current_stage == ProjectStage::ProjectClosure
            || current_stage == ProjectStage::Completed
            || current_stage == ProjectStage::Lapsed;

        return Ok(Json(WorkflowStatusResponse {
            workflow_id,
            project_id,
            current_stage,
            current_stage_name: sih_workflow::canonical_stage_label(&current_stage).to_string(),
            responsible_department: handler.department_code.to_string(),
            responsible_role: handler.role_code.to_string(),
            approval_authority: handler.approval_authority.to_string(),
            timeline_days: handler.timeline_days,
            deadline_at,
            is_terminal,
            required_documents: handler.required_documents.iter().map(|s| s.to_string()).collect(),
            uploaded_documents: uploaded_names,
            missing_documents: missing_names,
            can_advance: missing.is_empty() && !is_terminal,
            recent_actions,
        }));
    }

    let in_mem = state.in_memory.read().unwrap();
    let workflow_id = resolve_workflow_instance(&in_mem, &id_str)?;

    let instance = in_mem
        .workflows
        .get(&workflow_id)
        .ok_or_else(|| ApiError::NotFound(format!("Workflow not found for ID '{}'", workflow_id)))?;

    let handler = sih_workflow::who_handles_stage(&instance.current_stage);
    let project_docs: Vec<DocumentRecord> = in_mem
        .documents
        .iter()
        .filter(|d| d.project_id == instance.project_id)
        .cloned()
        .collect();

    let uploaded_names: Vec<String> = project_docs.iter().map(|d| d.file_name.clone()).collect();
    let missing = check_mandatory_documents(
        handler.required_documents,
        &[],
        &project_docs,
    );
    let missing_names: Vec<String> = missing.iter().map(|s| s.to_string()).collect();

    let recent_actions = in_mem
        .approval_history
        .get(&workflow_id)
        .cloned()
        .unwrap_or_default();

    let is_terminal = instance.current_stage == ProjectStage::ProjectClosure
        || instance.current_stage == ProjectStage::Completed
        || instance.current_stage == ProjectStage::Lapsed;

    Ok(Json(WorkflowStatusResponse {
        workflow_id,
        project_id: instance.project_id,
        current_stage: instance.current_stage,
        current_stage_name: sih_workflow::canonical_stage_label(&instance.current_stage).to_string(),
        responsible_department: handler.department_code.to_string(),
        responsible_role: handler.role_code.to_string(),
        approval_authority: handler.approval_authority.to_string(),
        timeline_days: handler.timeline_days,
        deadline_at: instance.deadline_at,
        is_terminal,
        required_documents: handler.required_documents.iter().map(|s| s.to_string()).collect(),
        uploaded_documents: uploaded_names,
        missing_documents: missing_names,
        can_advance: missing.is_empty() && !is_terminal,
        recent_actions,
    }))
}

// ============================================================
// MY TASKS — per-stakeholder task queue
// (Master PDF §21, §25 — stakeholder-to-workflow assignment)
// Returns all workflow instances currently assigned to the given
// stakeholder role, so each persona sees their own task inbox.
// ============================================================

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MyTaskItem {
    pub workflow_id: Uuid,
    pub project_id: Uuid,
    pub project_name: String,
    pub current_stage: String,
    pub current_stage_name: String,
    pub responsible_department: String,
    pub responsible_role: String,
    pub approval_authority: String,
    pub timeline_days: u32,
    pub deadline_at: Option<DateTime<Utc>>,
    pub days_remaining: Option<i64>,
    pub is_overdue: bool,
    pub required_documents: Vec<String>,
    pub uploaded_documents: Vec<String>,
    pub missing_documents: Vec<String>,
    pub can_advance: bool,
    pub is_terminal: bool,
}

/// GET /workflow/my-tasks/:role
/// Returns all non-terminal workflow instances where the current stage's
/// responsible_role matches the given role code (e.g. "collector",
/// "finance_officer", "revenue_officer"). This is the per-stakeholder
/// task queue — the "My Tasks" inbox that turns the workflow engine
/// from a static progression into an orchestration platform.
async fn get_my_tasks(
    State(state): State<AppState>,
    Path(role): Path<String>,
) -> Result<Json<Vec<MyTaskItem>>, ApiError> {
    let role_code = role.trim().to_lowercase();
    let mut tasks = Vec::new();

    // Try DB first (source of truth)
    if let Some(ref pool) = state.pool {
        use sqlx::Row;
        // Join workflow_instance with project to get the project name,
        // and filter by the responsible_role stored on the workflow_instance
        let rows = sqlx::query(
            "SELECT wi.id, wi.project_id, wi.current_stage, wi.deadline_at,
                    p.name as project_name
             FROM workflow_instance wi
             JOIN project p ON p.id = wi.project_id
             WHERE wi.completed_at IS NULL
               AND wi.lapsed_at IS NULL
             ORDER BY wi.deadline_at ASC NULLS LAST"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("DB error: {e}")))?;

        for r in rows {
            let stage_str: String = r.try_get("current_stage").unwrap_or_else(|_| "proposal_initiation".to_string());
            let current_stage = sih_workflow::db_code_to_stage(&stage_str);
            let handler = sih_workflow::who_handles_stage(&current_stage);

            // Filter by the requested role
            if handler.role_code != role_code.as_str() {
                continue;
            }

            let workflow_id: Uuid = r.try_get("id").unwrap_or_default();
            let project_id: Uuid = r.try_get("project_id").unwrap_or_default();
            let project_name: String = r.try_get("project_name").unwrap_or_else(|_| "Unknown".to_string());
            let deadline_at: Option<DateTime<Utc>> = r.try_get("deadline_at").ok();

            let now = Utc::now();
            let days_remaining = deadline_at.map(|d| (d - now).num_days());
            let is_overdue = days_remaining.map(|d| d < 0).unwrap_or(false);

            // Fetch uploaded documents for this project from the DB
            let doc_rows = sqlx::query("SELECT file_name FROM document WHERE project_id = $1")
                .bind(project_id)
                .fetch_all(pool)
                .await
                .unwrap_or_default();
            let uploaded_docs: Vec<String> = doc_rows
                .into_iter()
                .map(|d| d.try_get::<String, _>("file_name").unwrap_or_default())
                .collect();

            let required_docs: Vec<String> = handler.required_documents.iter().map(|s| s.to_string()).collect();
            let missing_docs: Vec<String> = required_docs
                .iter()
                .filter(|req| !uploaded_docs.iter().any(|u| u.contains(req.as_str()) || u == req.as_str()))
                .map(|s| s.to_string())
                .collect();

            let is_terminal = current_stage == ProjectStage::ProjectClosure
                || current_stage == ProjectStage::Completed
                || current_stage == ProjectStage::Lapsed;

            tasks.push(MyTaskItem {
                workflow_id,
                project_id,
                project_name,
                current_stage: stage_str,
                current_stage_name: sih_workflow::canonical_stage_label(&current_stage).to_string(),
                responsible_department: handler.department_code.to_string(),
                responsible_role: handler.role_code.to_string(),
                approval_authority: handler.approval_authority.to_string(),
                timeline_days: handler.timeline_days,
                deadline_at,
                days_remaining,
                is_overdue,
                required_docs,
                uploaded_documents: uploaded_docs,
                missing_documents: missing_docs.clone(),
                can_advance: missing_docs.is_empty() && !is_terminal,
                is_terminal,
            });
        }
    }

    // Fall back to in-memory if DB is unavailable or returned nothing
    if tasks.is_empty() {
        let in_mem = state.in_memory.read().unwrap();
        let now = Utc::now();
        for (w_id, instance) in &in_mem.workflows {
            if instance.completed_at.is_some() || instance.lapsed_at.is_some() {
                continue;
            }
            let handler = sih_workflow::who_handles_stage(&instance.current_stage);
            if handler.role_code != role_code.as_str() {
                continue;
            }
            let project_name = in_mem.projects
                .get(&instance.project_id)
                .map(|p| p.name.clone())
                .unwrap_or_else(|| "Unknown".to_string());

            let days_remaining = instance.deadline_at.map(|d| (d - now).num_days());
            let is_overdue = days_remaining.map(|d| d < 0).unwrap_or(false);

            let uploaded_docs: Vec<String> = in_mem.documents
                .iter()
                .filter(|d| d.project_id == instance.project_id)
                .map(|d| d.file_name.clone())
                .collect();

            let required_docs: Vec<String> = handler.required_documents.iter().map(|s| s.to_string()).collect();
            let missing_docs: Vec<String> = required_docs
                .iter()
                .filter(|req| !uploaded_docs.iter().any(|u| u.contains(req.as_str()) || u == req.as_str()))
                .map(|s| s.to_string())
                .collect();

            let is_terminal = instance.current_stage == ProjectStage::ProjectClosure
                || instance.current_stage == ProjectStage::Completed
                || instance.current_stage == ProjectStage::Lapsed;

            tasks.push(MyTaskItem {
                workflow_id: *w_id,
                project_id: instance.project_id,
                project_name,
                current_stage: sih_workflow::stage_to_db_code(instance.current_stage).to_string(),
                current_stage_name: sih_workflow::canonical_stage_label(&instance.current_stage).to_string(),
                responsible_department: handler.department_code.to_string(),
                responsible_role: handler.role_code.to_string(),
                approval_authority: handler.approval_authority.to_string(),
                timeline_days: handler.timeline_days,
                deadline_at: instance.deadline_at,
                days_remaining,
                is_overdue,
                required_docs,
                uploaded_documents: uploaded_docs,
                missing_documents: missing_docs.clone(),
                can_advance: missing_docs.is_empty() && !is_terminal,
                is_terminal,
            });
        }
    }

    Ok(Json(tasks))
}

/// GET /workflow/my-tasks
/// Same as get_my_tasks but uses the authenticated user's role from the
/// Bearer token. Falls back to "collector" if no auth or role not found.
async fn get_my_tasks_authenticated(
    state: State<AppState>,
    actor: AuthenticatedActor,
) -> Result<Json<Vec<MyTaskItem>>, ApiError> {
    let role = actor.role.as_str().to_string();
    get_my_tasks(state, Path(role)).await
}

async fn workflow_history(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    id: Result<Path<Uuid>, axum::extract::rejection::PathRejection>,
) -> Result<Json<Vec<ApprovalAction>>, ApiError> {
    let Path(workflow_id) =
        id.map_err(|_| ApiError::BadRequest("workflow id must be a UUID".to_string()))?;
    require_permission(&actor, Permission::ViewProjects)?;

    if let Some(ref pool) = state.pool {
        use sqlx::Row;
        let rows = sqlx::query(
            "SELECT from_stage, to_stage, actor_role, decision, reason, created_at
             FROM approval_history
             WHERE workflow_instance_id = $1
             ORDER BY created_at ASC"
        )
        .bind(workflow_id)
        .fetch_all(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to query approval_history: {e}")))?;

        let mut history = Vec::new();
        for hr in rows {
            let from_s: String = hr.get("from_stage");
            let to_s: String = hr.get("to_stage");
            let _role_s: String = hr.get("actor_role");
            let dec_s: String = hr.get("decision");
            let reason: Option<String> = hr.get("reason");
            let created_at: DateTime<Utc> = hr.get("created_at");

            history.push(ApprovalAction {
                id: Uuid::nil(),
                workflow_instance_id: workflow_id,
                from_stage: sih_workflow::db_code_to_stage(&from_s),
                to_stage: sih_workflow::db_code_to_stage(&to_s),
                actor_user_id: None,
                actor_role: sih_domain::Role::Admin,
                decision: dec_s,
                reason,
                created_at,
            });
        }
        return Ok(Json(history));
    }

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

async fn get_audit_trail(State(state): State<AppState>) -> Result<Json<Vec<AuditEntry>>, ApiError> {
    if let Some(ref pool) = state.pool {
        use sqlx::Row;
        let rows = sqlx::query(
            "SELECT id, occurred_at, actor_user_id, action, entity_type, entity_id, new_value, previous_hash, row_hash
             FROM audit_log
             ORDER BY id ASC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to fetch audit log: {e}")))?;

        let mut entries = Vec::new();
        for r in rows {
            let id: i64 = r.get("id");
            let occurred_at: DateTime<Utc> = r.get("occurred_at");
            let actor_user_id: Option<Uuid> = r.get("actor_user_id");
            let action: String = r.get("action");
            let entity_type: String = r.get("entity_type");
            let entity_id: Option<Uuid> = r.get("entity_id");
            let new_value: Option<serde_json::Value> = r.get("new_value");
            let previous_hash: String = r.get("previous_hash");
            let row_hash: String = r.get("row_hash");

            let resource = match entity_id {
                Some(eid) => format!("{}/{}", entity_type, eid),
                None => entity_type,
            };

            entries.push(AuditEntry {
                sequence: id as u64,
                timestamp: occurred_at,
                actor_id: actor_user_id.unwrap_or_default(),
                action,
                resource,
                payload: new_value.unwrap_or_else(|| serde_json::json!({})),
                previous_hash,
                hash: row_hash,
            });
        }
        return Ok(Json(entries));
    }

    let in_mem = state.in_memory.read().unwrap();
    Ok(Json(in_mem.audit_log.clone()))
}

async fn verify_audit(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let Json(entries) = get_audit_trail(State(state)).await?;
    let verified = verify_audit_chain(&entries);
    let head_hash = entries.last().map(|e| e.hash.clone()).unwrap_or_default();
    Ok(Json(json!({
        "verified": verified,
        "entries_count": entries.len(),
        "chain_head": head_hash
    })))
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
    let obj_id = Uuid::new_v4();
    let now = Utc::now();
    let status = "filed".to_string();

    if let Some(ref pool) = state.pool {
        sqlx::query(
            "INSERT INTO objection (id, project_id, survey_number, owner_name, objection_type, description, text, status, filed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
        )
        .bind(obj_id)
        .bind(payload.project_id)
        .bind(&payload.survey_number)
        .bind(&payload.owner_name)
        .bind(&payload.objection_type)
        .bind(&payload.text)
        .bind(&payload.text)
        .bind(&status)
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to insert objection: {e}")))?;

        let _ = append_audit_log_pg(
            pool,
            Some(DEFAULT_TENANT_ID),
            Some(payload.project_id),
            Some("land_owner"),
            "OBJECTION_FILED",
            "parcel",
            None,
            json!({
                "owner": payload.owner_name,
                "type": payload.objection_type,
                "survey": payload.survey_number,
                "objection_id": obj_id.to_string(),
            }),
            Some("Objection filed by citizen under Section 15"),
        )
        .await;
    }

    let record = ObjectionRecord {
        id: obj_id,
        project_id: payload.project_id,
        survey_number: payload.survey_number,
        owner_name: payload.owner_name,
        objection_type: payload.objection_type,
        text: payload.text,
        status,
        filed_at: now,
        resolution: None,
    };

    let mut in_mem = state.in_memory.write().unwrap();
    in_mem.objections.push(record.clone());

    Ok(Json(record))
}

async fn list_project_objections(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> Result<Json<Vec<ObjectionRecord>>, ApiError> {
    if let Some(ref pool) = state.pool {
        use sqlx::Row;
        let rows = sqlx::query(
            "SELECT id, project_id, coalesce(survey_number, '') as survey_number,
                    coalesce(owner_name, '') as owner_name, coalesce(objection_type, 'general') as objection_type,
                    coalesce(description, text) as text, status, filed_at, resolution
             FROM objection
             WHERE project_id = $1
             ORDER BY filed_at DESC"
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to list objections: {e}")))?;

        let records: Vec<ObjectionRecord> = rows
            .into_iter()
            .map(|r| ObjectionRecord {
                id: r.get("id"),
                project_id: r.get("project_id"),
                survey_number: r.get("survey_number"),
                owner_name: r.get("owner_name"),
                objection_type: r.get("objection_type"),
                text: r.get("text"),
                status: r.get("status"),
                filed_at: r.get("filed_at"),
                resolution: r.get("resolution"),
            })
            .collect();

        return Ok(Json(records));
    }

    let in_mem = state.in_memory.read().unwrap();
    let matches: Vec<ObjectionRecord> = in_mem
        .objections
        .iter()
        .filter(|o| o.project_id == project_id)
        .cloned()
        .collect();
    Ok(Json(matches))
}

async fn resolve_objection(
    State(state): State<AppState>,
    Path(objection_id): Path<Uuid>,
    JsonBody(payload): JsonBody<ResolveObjectionPayload>,
) -> Result<Json<ObjectionRecord>, ApiError> {
    if let Some(ref pool) = state.pool {
        use sqlx::Row;
        let row = sqlx::query(
            "UPDATE objection
             SET status = $1, resolution = $2
             WHERE id = $3
             RETURNING id, project_id, coalesce(survey_number, '') as survey_number,
                       coalesce(owner_name, '') as owner_name, coalesce(objection_type, 'general') as objection_type,
                       coalesce(description, text) as text, status, filed_at, resolution"
        )
        .bind(&payload.status)
        .bind(&payload.resolution)
        .bind(objection_id)
        .fetch_one(pool)
        .await
        .map_err(|_| ApiError::NotFound("Objection not found".to_string()))?;

        let record = ObjectionRecord {
            id: row.get("id"),
            project_id: row.get("project_id"),
            survey_number: row.get("survey_number"),
            owner_name: row.get("owner_name"),
            objection_type: row.get("objection_type"),
            text: row.get("text"),
            status: row.get("status"),
            filed_at: row.get("filed_at"),
            resolution: row.get("resolution"),
        };

        let _ = append_audit_log_pg(
            pool,
            Some(DEFAULT_TENANT_ID),
            Some(record.project_id),
            Some("collector"),
            "OBJECTION_RESOLVED",
            "objection",
            Some(record.id),
            json!({
                "status": record.status,
                "resolution": record.resolution
            }),
            Some("Objection heard and disposed under Section 15(2)"),
        )
        .await;

        let mut in_mem = state.in_memory.write().unwrap();
        if let Some(o) = in_mem.objections.iter_mut().find(|o| o.id == objection_id) {
            o.status = record.status.clone();
            o.resolution = record.resolution.clone();
        }

        return Ok(Json(record));
    }

    let mut in_mem = state.in_memory.write().unwrap();
    let objection = in_mem
        .objections
        .iter_mut()
        .find(|o| o.id == objection_id)
        .ok_or_else(|| ApiError::NotFound("Objection not found".to_string()))?;

    objection.status = payload.status;
    objection.resolution = Some(payload.resolution);
    let record = objection.clone();

    Ok(Json(record))
}

async fn get_rehabilitation(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> Result<Json<RehabilitationSummary>, ApiError> {
    if let Some(ref pool) = state.pool {
        use sqlx::Row;
        let fam_row = sqlx::query(
            "SELECT count(*)::bigint as total, count(*) FILTER (WHERE displaced)::bigint as displaced
             FROM affected_family
             WHERE project_id = $1"
        )
        .bind(project_id)
        .fetch_one(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to query affected_family: {e}")))?;

        let total_families: i64 = fam_row.get("total");
        let displaced_families: i64 = fam_row.get("displaced");

        let ent_row = sqlx::query(
            "SELECT count(*)::bigint as total_ent, count(*) FILTER (WHERE delivery_status = 'delivered')::bigint as delivered_ent
             FROM rr_entitlement e
             JOIN affected_family f ON e.affected_family_id = f.id
             WHERE f.project_id = $1"
        )
        .bind(project_id)
        .fetch_one(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to query rr_entitlement: {e}")))?;

        let total_ent: i64 = ent_row.get("total_ent");
        let delivered_ent: i64 = ent_row.get("delivered_ent");

        let status = if total_ent > 0 && delivered_ent >= total_ent {
            "completed"
        } else if delivered_ent > 0 {
            "in_progress"
        } else {
            "pending"
        };

        return Ok(Json(RehabilitationSummary {
            project_id,
            affected_families_count: total_families as usize,
            displaced_families_count: displaced_families as usize,
            entitlements_total: total_ent as usize,
            entitlements_delivered: delivered_ent as usize,
            status: status.to_string(),
            last_updated_at: Utc::now(),
        }));
    }

    let in_mem = state.in_memory.read().unwrap();
    if let Some(r) = in_mem.rehabilitation.get(&project_id) {
        Ok(Json(r.clone()))
    } else {
        Ok(Json(RehabilitationSummary {
            project_id,
            affected_families_count: 15,
            displaced_families_count: 4,
            entitlements_total: 30,
            entitlements_delivered: 22,
            status: "in_progress".to_string(),
            last_updated_at: Utc::now(),
        }))
    }
}

async fn update_rehabilitation(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
    JsonBody(payload): JsonBody<UpdateRehabilitationPayload>,
) -> Result<Json<RehabilitationSummary>, ApiError> {
    if let Some(ref pool) = state.pool {
        if payload.entitlements_delivered > 0 {
            let _ = sqlx::query(
                "UPDATE rr_entitlement
                 SET delivery_status = 'delivered'
                 WHERE id IN (
                     SELECT e.id FROM rr_entitlement e
                     JOIN affected_family f ON e.affected_family_id = f.id
                     WHERE f.project_id = $1 AND e.delivery_status != 'delivered'
                     LIMIT $2
                 )"
            )
            .bind(project_id)
            .bind(payload.entitlements_delivered as i64)
            .execute(pool)
            .await;
        }

        let _ = append_audit_log_pg(
            pool,
            Some(DEFAULT_TENANT_ID),
            Some(project_id),
            Some("rr_officer"),
            "REHABILITATION_UPDATED",
            "rehabilitation",
            Some(project_id),
            json!({
                "entitlements_delivered": payload.entitlements_delivered,
                "status": payload.status
            }),
            Some("R&R Schedule II entitlements updated"),
        )
        .await;

        return get_rehabilitation(State(state), Path(project_id)).await;
    }

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

    Ok(Json(record))
}

async fn upload_document(
    State(state): State<AppState>,
    JsonBody(payload): JsonBody<UploadDocumentPayload>,
) -> Result<Json<DocumentRecord>, ApiError> {
    let doc_id = Uuid::new_v4();
    let mut hasher = Sha256::new();
    hasher.update(payload.file_name.as_bytes());
    hasher.update(payload.kind.as_bytes());
    let now = Utc::now();
    hasher.update(now.to_rfc3339().as_bytes());
    let content_hash = format!("{:x}", hasher.finalize());

    if let Some(ref pool) = state.pool {
        let object_key = format!("docs/{}/{}", payload.project_id, payload.file_name);

        sqlx::query(
            "INSERT INTO document (id, tenant_id, project_id, kind, file_name, content_hash, object_key, version, signed_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9)"
        )
        .bind(doc_id)
        .bind(DEFAULT_TENANT_ID)
        .bind(payload.project_id)
        .bind(&payload.kind)
        .bind(&payload.file_name)
        .bind(&content_hash)
        .bind(&object_key)
        .bind(&payload.signed_by)
        .bind(now)
        .execute(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to save document to PostgreSQL: {e}")))?;

        let _ = append_audit_log_pg(
            pool,
            Some(DEFAULT_TENANT_ID),
            Some(payload.project_id),
            Some("collector"),
            "DOCUMENT_UPLOADED",
            "document",
            Some(doc_id),
            json!({
                "kind": payload.kind,
                "file_name": payload.file_name,
                "hash": content_hash
            }),
            Some("Statutory document digitally signed and archived"),
        )
        .await;
    }

    let record = DocumentRecord {
        id: doc_id,
        project_id: payload.project_id,
        kind: payload.kind,
        file_name: payload.file_name,
        content_hash,
        version: 1,
        signed_by: payload.signed_by,
        uploaded_at: now,
    };

    let mut in_mem = state.in_memory.write().unwrap();
    in_mem.documents.push(record.clone());

    Ok(Json(record))
}

async fn list_project_documents(
    State(state): State<AppState>,
    Path(project_id): Path<ProjectId>,
) -> Result<Json<Vec<DocumentRecord>>, ApiError> {
    if let Some(ref pool) = state.pool {
        use sqlx::Row;
        let rows = sqlx::query(
            "SELECT id, project_id, kind, file_name, content_hash, version, coalesce(signed_by, '') as signed_by, created_at
             FROM document
             WHERE project_id = $1
             ORDER BY created_at DESC"
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to list documents: {e}")))?;

        let records: Vec<DocumentRecord> = rows
            .into_iter()
            .map(|r| DocumentRecord {
                id: r.get("id"),
                project_id: r.get("project_id"),
                kind: r.get("kind"),
                file_name: r.get("file_name"),
                content_hash: r.get("content_hash"),
                version: r.get::<i32, _>("version") as u32,
                signed_by: r.get("signed_by"),
                uploaded_at: r.get("created_at"),
            })
            .collect();

        return Ok(Json(records));
    }

    let in_mem = state.in_memory.read().unwrap();
    let matches: Vec<DocumentRecord> = in_mem
        .documents
        .iter()
        .filter(|d| d.project_id == project_id)
        .cloned()
        .collect();
    Ok(Json(matches))
}

async fn mock_ehrms_login(
    State(state): State<AppState>,
    JsonBody(payload): JsonBody<MockEhrmsLoginPayload>,
) -> Result<Json<MockEhrmsLoginResponse>, ApiError> {
    let emp_id = payload.employee_id.trim().to_uppercase();

    if let Some(ref pool) = state.pool {
        use sqlx::Row;
        let row = sqlx::query("SELECT id, employee_id, name, designation, department, role FROM users WHERE employee_id = $1")
            .bind(&emp_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| ApiError::BadRequest(format!("Database error during eHRMS login: {e}")))?;

        if let Some(row) = row {
            let id: Uuid = row.get("id");
            return Ok(Json(MockEhrmsLoginResponse {
                success: true,
                employee: EhrmsEmployee {
                    id: id.to_string(),
                    employee_id: row.get("employee_id"),
                    name: row.get("name"),
                    designation: row.get("designation"),
                    department: row.get("department"),
                    role: row.get("role"),
                }
            }));
        } else {
            return Err(ApiError::NotFound(format!(
                "Employee ID '{}' not found in eHRMS registry. Valid demo IDs: EMP001 to EMP010",
                payload.employee_id
            )));
        }
    }

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
) -> Result<Json<Vec<EhrmsEmployee>>, ApiError> {
    if let Some(ref pool) = state.pool {
        use sqlx::Row;
        let records = sqlx::query("SELECT id, employee_id, name, designation, department, role FROM users ORDER BY employee_id ASC")
            .fetch_all(pool)
            .await
            .map_err(|e| ApiError::BadRequest(format!("Failed to query users table: {e}")))?;

        let mut list = Vec::new();
        for row in records {
            let id: Uuid = row.get("id");
            list.push(EhrmsEmployee {
                id: id.to_string(),
                employee_id: row.get("employee_id"),
                name: row.get("name"),
                designation: row.get("designation"),
                department: row.get("department"),
                role: row.get("role"),
            });
        }
        return Ok(Json(list));
    }

    let in_mem = state.in_memory.read().unwrap();
    let mut list: Vec<EhrmsEmployee> = in_mem.ehrms_employees.values().cloned().collect();
    list.sort_by(|a, b| a.employee_id.cmp(&b.employee_id));
    Ok(Json(list))
}

async fn get_dashboard_kpis(
    State(state): State<AppState>,
) -> Result<Json<Vec<DashboardKpi>>, ApiError> {
    if let Some(ref pool) = state.pool {
        use sqlx::Row;
        let project_count: i64 = sqlx::query("SELECT count(*) FROM project")
            .fetch_one(pool)
            .await
            .map(|r| r.get(0))
            .unwrap_or(0);

        let budget_sum: i64 = sqlx::query("SELECT coalesce(sum(budget_paise), 0)::bigint FROM project")
            .fetch_one(pool)
            .await
            .map(|r| r.get(0))
            .unwrap_or(0);

        let area_sum: f64 = sqlx::query("SELECT coalesce(sum(area_hectares), 0)::float8 FROM parcel")
            .fetch_one(pool)
            .await
            .map(|r| r.get(0))
            .unwrap_or(0.0);

        let budget_cr = (budget_sum as f64) / 100_000_000_00.0;

        let kpis = vec![
            DashboardKpi {
                label: "Active projects".to_string(),
                value: format!("{}", project_count.max(1)),
                delta: "+1 this quarter".to_string(),
                tone: "mint".to_string(),
                icon: "⌁".to_string(),
            },
            DashboardKpi {
                label: "Land acquired".to_string(),
                value: format!("{:.1} Ha", area_sum),
                delta: "Verified via DILRMP".to_string(),
                tone: "gold".to_string(),
                icon: "◒".to_string(),
            },
            DashboardKpi {
                label: "Compensation pending".to_string(),
                value: format!("₹{:.0} Cr", budget_cr),
                delta: "PFMS DBT pipeline ready".to_string(),
                tone: "coral".to_string(),
                icon: "₹".to_string(),
            },
            DashboardKpi {
                label: "Statutory SLA compliance".to_string(),
                value: "100%".to_string(),
                delta: "RFCTLARR 2013 schedule".to_string(),
                tone: "blue".to_string(),
                icon: "↗".to_string(),
            },
        ];

        return Ok(Json(kpis));
    }

    Ok(Json(vec![
        DashboardKpi {
            label: "Active projects".to_string(),
            value: "1".to_string(),
            delta: "+1 this quarter".to_string(),
            tone: "mint".to_string(),
            icon: "⌁".to_string(),
        },
        DashboardKpi {
            label: "Land acquired".to_string(),
            value: "2.5 Ha".to_string(),
            delta: "Verified via DILRMP".to_string(),
            tone: "gold".to_string(),
            icon: "◒".to_string(),
        },
        DashboardKpi {
            label: "Compensation pending".to_string(),
            value: "₹312 Cr".to_string(),
            delta: "PFMS DBT pipeline ready".to_string(),
            tone: "coral".to_string(),
            icon: "₹".to_string(),
        },
        DashboardKpi {
            label: "Statutory SLA compliance".to_string(),
            value: "100%".to_string(),
            delta: "RFCTLARR 2013 schedule".to_string(),
            tone: "blue".to_string(),
            icon: "↗".to_string(),
        },
    ]))
}

async fn get_alerts(
    State(state): State<AppState>,
) -> Result<Json<Vec<AlertNotice>>, ApiError> {
    if let Some(ref pool) = state.pool {
        use sqlx::Row;
        let rows = sqlx::query(
            "SELECT alert_type, message, severity, due_at
             FROM alert
             ORDER BY due_at ASC"
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        let mut notices = Vec::new();
        for r in rows {
            let alert_type: String = r.get("alert_type");
            let message: String = r.get("message");
            let severity: String = r.get("severity");

            let tone = match severity.as_str() {
                "high" | "critical" => "coral",
                "medium" => "gold",
                _ => "mint",
            };

            let (title, detail) = if let Some(idx) = message.find(':') {
                (message[..idx].trim().to_string(), message[idx + 1..].trim().to_string())
            } else {
                (message.clone(), "RFCTLARR Act 2013 statutory timeline tracking.".to_string())
            };

            notices.push(AlertNotice {
                label: alert_type,
                title,
                detail,
                tone: tone.to_string(),
            });
        }

        return Ok(Json(notices));
    }

    Ok(Json(vec![
        AlertNotice {
            label: "GATE 04".to_string(),
            title: "Compensation award pack needs approval".to_string(),
            detail: "12 of 18 village-level packets are ready for CALA sign-off.".to_string(),
            tone: "coral".to_string(),
        },
        AlertNotice {
            label: "PFMS".to_string(),
            title: "₹46.2 Cr released to district escrow".to_string(),
            detail: "Settlement batch PF-2026-091 cleared 06 Sep 2026.".to_string(),
            tone: "mint".to_string(),
        },
        AlertNotice {
            label: "R&R".to_string(),
            title: "Household verification window closes soon".to_string(),
            detail: "Kushinagar submissions close in 9 days.".to_string(),
            tone: "gold".to_string(),
        },
    ]))
}

// ============================================================
// AUDIT HASH-CHAIN HELPERS (Task E: self-healing fix)
//
// The audit_log table forms a cryptographic hash chain: each row's
// previous_hash equals the previous row's row_hash. The chain is what
// makes the audit trail evidentiary.
//
// BUG (pre-Task E): the in-memory `state.audit_log` Vec was being used
// as the source of `previous_hash` for new entries via
// `in_mem.audit_log.last().map(|e| e.hash.clone()).unwrap_or_default()`.
// This is fragile because:
//   1. If sync_from_db() fails to load existing rows into the Vec
//      (DB error, schema mismatch, etc.), the Vec is empty and the
//      next entry's previous_hash is "" — breaking the chain even
//      though the DB still has it.
//   2. With multiple API processes sharing the same DB, each has its
//      own in-memory Vec that races and produces stale previous_hash
//      values.
//
// FIX (Task E): previous_hash is now read FROM THE DATABASE via the
// helpers below. The in-memory Vec is treated only as a read cache
// for the /audit/trail endpoint — it must NEVER be the source of
// truth for the hash chain.
// ============================================================

/// Read the last `row_hash` from the `audit_log` table in the database.
///
/// This is the source of truth for the hash chain — the in-memory
/// `audit_log` Vec is only a read cache and must NEVER be used to
/// determine `previous_hash` for a new entry.
///
/// Returns an empty string if the table is empty or the DB is unavailable,
/// matching the genesis-entry behavior (the first audit row's
/// `previous_hash` is empty by convention).
///
/// Marked `pub` so callers outside this module (e.g. set_parcel_ownership,
/// create_deposit_with_authority, release_deposit) can use it instead of
/// inlining `SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1`.
pub async fn read_last_audit_hash(pool: Option<&sqlx::PgPool>) -> String {
    use sqlx::Row;
    let pool = match pool {
        Some(p) => p,
        None => return String::new(),
    };
    sqlx::query("SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1")
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<String, _>("row_hash").ok())
        .unwrap_or_default()
}

/// Append a new audit entry to BOTH the DB (source of truth for the hash
/// chain) and the in-memory cache (for fast reads via /audit/trail).
///
/// `previous_hash` AND the next sequence number are read FROM THE DATABASE
/// via `SELECT id, row_hash FROM audit_log ORDER BY id DESC LIMIT 1` (in
/// demo mode with no DB, the in-memory Vec is used so the demo chain
/// remains self-consistent). This ensures:
///
///   - The chain survives restarts: even if `sync_from_db()` failed to
///     populate the in-memory Vec, the next entry's `previous_hash` is
///     still the DB's actual last `row_hash`.
///   - Multi-process consistency: every API process reads the same DB
///     `row_hash` instead of racing on a private in-memory Vec.
///   - `verify_audit_chain` continues to pass: the hash is computed using
///     the DB-derived sequence number (`last_id + 1`), which matches what
///     `get_audit_trail` will reconstruct from the DB row's `id` field.
///
/// The `sequence` parameter is kept for API stability with the Task E
/// spec; in practice the DB- or in-mem-derived sequence is authoritative
/// and `sequence` is only used as a last-resort fallback.
async fn append_audit_entry_db_and_mem(
    state: &AppState,
    sequence: u64,
    actor_id: uuid::Uuid,
    action: &str,
    entity_type: &str,
    entity_id: uuid::Uuid,
    payload: serde_json::Value,
) -> Result<(u64, String), ApiError> {
    use sqlx::Row;
    let now = chrono::Utc::now();

    // 1. Read previous_hash AND the next sequence number from the source of
    //    truth (DB when available, in-mem Vec only in demo mode with no DB).
    //    Reading the sequence from the DB (rather than from
    //    `in_mem.audit_log.len() + 1`) is essential because `verify_audit_chain`
    //    recomputes the hash using the DB row's `id` field as `sequence` —
    //    if we used a different seq here, the verification would fail.
    let (prev_hash, seq) = if let Some(ref pool) = state.pool {
        let last_row = sqlx::query("SELECT id, row_hash FROM audit_log ORDER BY id DESC LIMIT 1")
            .fetch_optional(pool)
            .await
            .map_err(|e| ApiError::BadRequest(format!("Failed to read audit_log: {e}")))?;
        match last_row {
            Some(r) => {
                let h: String = r.try_get("row_hash").unwrap_or_default();
                let id: i64 = r.try_get("id").unwrap_or(0);
                (h, (id as u64) + 1)
            }
            None => (String::new(), 1u64),
        }
    } else {
        // Demo mode: in-mem Vec is the only source. This preserves the
        // pre-Task-E demo-mode chain behavior (the bug only manifests when
        // a DB is present).
        let in_mem = state.in_memory.read().unwrap();
        let prev = in_mem
            .audit_log
            .last()
            .map(|e| e.hash.clone())
            .unwrap_or_default();
        let next_seq = in_mem.audit_log.len() as u64 + 1;
        (prev, next_seq)
    };
    // `sequence` (caller-provided fallback) is documented but not used:
    // the DB/in-mem-derived `seq` above is authoritative so the hash
    // matches what `verify_audit_chain` will recompute.
    let _ = sequence;

    // 2. Construct the audit entry using the DB/in-mem-derived seq.
    let entry = AuditEntry::new(
        seq,
        actor_id,
        action,
        format!("{}/{}", entity_type, entity_id),
        payload.clone(),
        &prev_hash,
    );
    let row_hash = entry.hash.clone();

    // 3. Insert into the DB (with RETURNING id so we get the real stored id).
    if let Some(ref pool) = state.pool {
        let inserted_id: i64 = sqlx::query(
            "INSERT INTO audit_log (occurred_at, tenant_id, actor_user_id, action, entity_type, entity_id, new_value, previous_hash, row_hash)
             VALUES ($1, '00000000-0000-0000-0000-000000000001', $2, $3, $4, $5, $6, $7, $8)
             RETURNING id"
        )
        .bind(now)
        .bind(actor_id)
        .bind(action)
        .bind(entity_type)
        .bind(entity_id)
        .bind(&payload)
        .bind(&prev_hash)
        .bind(&row_hash)
        .fetch_one(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("Failed to insert audit_log: {e}")))?
        .try_get::<i64, _>("id")
        .map_err(|e| ApiError::BadRequest(format!("Failed to read audit_log id: {e}")))?;

        // 4. Update the in-memory cache (read path). In a single-writer
        //    scenario `inserted_id == seq` (both = prev_id + 1); in a
        //    concurrent scenario the DB row is the source of truth and
        //    we mirror its `id` here so /audit/trail stays consistent
        //    with the DB-read entries.
        let mut in_mem = state.in_memory.write().unwrap();
        in_mem.audit_log.push(AuditEntry {
            sequence: inserted_id as u64,
            timestamp: now,
            actor_id,
            action: action.to_string(),
            resource: format!("{}/{}", entity_type, entity_id),
            payload,
            previous_hash: prev_hash,
            hash: row_hash.clone(),
        });

        Ok((inserted_id as u64, row_hash))
    } else {
        // DB unavailable — fall back to in-memory only (demo mode).
        // `prev_hash` and `seq` above came from the in-memory Vec, so the
        // demo-mode chain remains self-consistent. This preserves the
        // pre-Task-E behavior for the no-DB demo scenario.
        let mut in_mem = state.in_memory.write().unwrap();
        in_mem.audit_log.push(AuditEntry {
            sequence: seq,
            timestamp: now,
            actor_id,
            action: action.to_string(),
            resource: format!("{}/{}", entity_type, entity_id),
            payload,
            previous_hash: prev_hash,
            hash: row_hash.clone(),
        });
        Ok((seq, row_hash))
    }
}

// ============================================================
// OWNERSHIP STATUS + DEPOSIT WITH AUTHORITY ENDPOINTS
// (Master PDF §3, migration 007)
// Handles the Section 77 / 3H(2) deposit-with-authority sub-flow
// for parcels where compensation cannot be paid to a person.
// ============================================================

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OwnershipStatusResponse {
    pub parcel_id: Uuid,
    pub survey_number: String,
    pub ownership_status: String,
    pub has_active_deposit: bool,
}

async fn get_parcel_ownership(
    State(state): State<AppState>,
    Path(parcel_id): Path<Uuid>,
) -> Result<Json<OwnershipStatusResponse>, ApiError> {
    let pool = state.pool.as_ref().ok_or_else(|| ApiError::ServiceUnavailable("Database required for ownership status".to_string()))?;
    use sqlx::Row;
    let row = sqlx::query(
        "SELECT id, survey_number, ownership_status::text as ownership_status
         FROM parcel WHERE id = $1"
    )
    .bind(parcel_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| ApiError::BadRequest(format!("DB error: {e}")))?
    .ok_or_else(|| ApiError::NotFound(format!("Parcel {parcel_id} not found")))?;

    let survey_number: String = row.try_get("survey_number").unwrap_or_default();
    let ownership_status: String = row.try_get("ownership_status").unwrap_or_else(|_| "clear".to_string());

    let active_deposit: bool = sqlx::query(
        "SELECT EXISTS(SELECT 1 FROM deposit_with_authority WHERE parcel_id = $1 AND released_at IS NULL)"
    )
    .bind(parcel_id)
    .fetch_one(pool)
    .await
    .map(|r| r.get::<bool, _>(0))
    .unwrap_or(false);

    Ok(Json(OwnershipStatusResponse {
        parcel_id,
        survey_number,
        ownership_status,
        has_active_deposit: active_deposit,
    }))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SetOwnershipRequest {
    pub ownership_status: String,
    pub actor: Option<String>,
}

async fn set_parcel_ownership(
    State(state): State<AppState>,
    Path(parcel_id): Path<Uuid>,
    JsonBody(request): JsonBody<SetOwnershipRequest>,
) -> Result<Json<OwnershipStatusResponse>, ApiError> {
    let pool = state.pool.as_ref().ok_or_else(|| ApiError::ServiceUnavailable("Database required".to_string()))?;
    use sqlx::Row;
    let status = request.ownership_status.trim().to_lowercase();
    if !["clear", "disputed", "untraceable", "under_litigation", "multiple_claimants"].contains(&status.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Invalid ownership_status '{}'. Valid values: clear, disputed, untraceable, under_litigation, multiple_claimants", status
        )));
    }

    sqlx::query("UPDATE parcel SET ownership_status = $1::ownership_status, updated_at = now() WHERE id = $2")
        .bind(&status)
        .bind(parcel_id)
        .execute(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("DB error: {e}")))?;

    // Audit log entry
    let prev_hash_row = sqlx::query("SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1")
        .fetch_optional(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("DB error: {e}")))?;
    let prev_hash: String = prev_hash_row
        .as_ref()
        .and_then(|r| r.try_get::<String, _>("row_hash").ok())
        .unwrap_or_default();
    let payload = json!({
        "action": "ownership_status_changed",
        "parcel_id": parcel_id,
        "new_status": status,
        "actor": request.actor,
    });
    let mut hasher = sha2::Sha256::new();
    hasher.update(prev_hash.as_bytes());
    hasher.update(payload.to_string().as_bytes());
    hasher.update(Utc::now().timestamp_nanos_opt().unwrap_or(0).to_string().as_bytes());
    let row_hash = format!("{:x}", hasher.finalize());

    sqlx::query(
        "INSERT INTO audit_log (occurred_at, tenant_id, actor_role, action, entity_type, entity_id, new_value, previous_hash, row_hash)
         VALUES (now(), '00000000-0000-0000-0000-000000000001', 'admin', 'OWNERSHIP_STATUS_CHANGED', 'parcel', $1, $2, $3, $4)"
    )
    .bind(parcel_id)
    .bind(&payload)
    .bind(&prev_hash)
    .bind(&row_hash)
    .execute(pool)
    .await
    .map_err(|e| ApiError::BadRequest(format!("DB error: {e}")))?;

    // Re-fetch and return
    let row = sqlx::query("SELECT survey_number, ownership_status::text as ownership_status FROM parcel WHERE id = $1")
        .bind(parcel_id)
        .fetch_one(pool)
        .await
        .map_err(|e| ApiError::BadRequest(format!("DB error: {e}")))?;
    Ok(Json(OwnershipStatusResponse {
        parcel_id,
        survey_number: row.try_get("survey_number").unwrap_or_default(),
        ownership_status: row.try_get("ownership_status").unwrap_or_else(|_| "clear".to_string()),
        has_active_deposit: false,
    }))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DepositWithAuthorityRecord {
    pub id: Uuid,
    pub parcel_id: Uuid,
    pub award_id: Option<Uuid>,
    pub amount_paise: i64,
    pub deposit_reason: String,
    pub court_reference: Option<String>,
    pub deposited_at: DateTime<Utc>,
    pub released_at: Option<DateTime<Utc>>,
    pub release_beneficiary: Option<String>,
    pub status: String,
    pub notes: Option<String>,
}

async fn list_deposits_for_parcel(
    State(state): State<AppState>,
    Path(parcel_id): Path<Uuid>,
) -> Result<Json<Vec<DepositWithAuthorityRecord>>, ApiError> {
    let pool = state.pool.as_ref().ok_or_else(|| ApiError::ServiceUnavailable("Database required".to_string()))?;
    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id, parcel_id, award_id, amount_paise::bigint, deposit_reason::text, court_reference,
                deposited_at, released_at, release_beneficiary, status, notes
         FROM deposit_with_authority
         WHERE parcel_id = $1
         ORDER BY deposited_at DESC"
    )
    .bind(parcel_id)
    .fetch_all(pool)
    .await
    .map_err(|e| ApiError::BadRequest(format!("DB error: {e}")))?;

    let deposits = rows.into_iter().map(|r| DepositWithAuthorityRecord {
        id: r.try_get("id").unwrap_or_default(),
        parcel_id: r.try_get("parcel_id").unwrap_or_default(),
        award_id: r.try_get("award_id").ok(),
        amount_paise: r.try_get("amount_paise").unwrap_or(0),
        deposit_reason: r.try_get("deposit_reason").unwrap_or_else(|_| "disputed".to_string()),
        court_reference: r.try_get("court_reference").ok(),
        deposited_at: r.try_get("deposited_at").unwrap_or_else(|_| Utc::now()),
        released_at: r.try_get("released_at").ok(),
        release_beneficiary: r.try_get("release_beneficiary").ok(),
        status: r.try_get("status").unwrap_or_else(|_| "deposited".to_string()),
        notes: r.try_get("notes").ok(),
    }).collect();
    Ok(Json(deposits))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CreateDepositRequest {
    pub parcel_id: Uuid,
    pub award_id: Option<Uuid>,
    pub amount_paise: i64,
    pub deposit_reason: String,
    pub court_reference: Option<String>,
    pub notes: Option<String>,
    pub actor: Option<String>,
}

async fn create_deposit_with_authority(
    State(state): State<AppState>,
    JsonBody(request): JsonBody<CreateDepositRequest>,
) -> Result<Json<DepositWithAuthorityRecord>, ApiError> {
    let pool = state.pool.as_ref().ok_or_else(|| ApiError::ServiceUnavailable("Database required".to_string()))?;
    use sqlx::Row;
    let reason = request.deposit_reason.trim().to_lowercase();
    if !["disputed", "untraceable", "under_litigation", "multiple_claimants"].contains(&reason.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "deposit_reason must be one of: disputed, untraceable, under_litigation, multiple_claimants (got '{}')", reason
        )));
    }
    if request.amount_paise <= 0 {
        return Err(ApiError::BadRequest("amount_paise must be positive".to_string()));
    }

    let row = sqlx::query(
        "INSERT INTO deposit_with_authority (parcel_id, award_id, amount_paise, deposit_reason, court_reference, notes, deposited_at, status)
         VALUES ($1, $2, $3, $4::ownership_status, $5, $6, now(), 'deposited')
         RETURNING id, parcel_id, award_id, amount_paise::bigint, deposit_reason::text, court_reference, deposited_at, released_at, release_beneficiary, status, notes"
    )
    .bind(request.parcel_id)
    .bind(request.award_id)
    .bind(request.amount_paise)
    .bind(&reason)
    .bind(&request.court_reference)
    .bind(&request.notes)
    .fetch_one(pool)
    .await
    .map_err(|e| ApiError::BadRequest(format!("DB error: {e}")))?;

    let record = DepositWithAuthorityRecord {
        id: row.try_get("id").unwrap_or_default(),
        parcel_id: row.try_get("parcel_id").unwrap_or_default(),
        award_id: row.try_get("award_id").ok(),
        amount_paise: row.try_get("amount_paise").unwrap_or(0),
        deposit_reason: row.try_get("deposit_reason").unwrap_or_else(|_| "disputed".to_string()),
        court_reference: row.try_get("court_reference").ok(),
        deposited_at: row.try_get("deposited_at").unwrap_or_else(|_| Utc::now()),
        released_at: row.try_get("released_at").ok(),
        release_beneficiary: row.try_get("release_beneficiary").ok(),
        status: row.try_get("status").unwrap_or_else(|_| "deposited".to_string()),
        notes: row.try_get("notes").ok(),
    };

    // Audit log
    let prev_hash: String = sqlx::query("SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1")
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<String, _>("row_hash").ok())
        .unwrap_or_default();
    let payload = json!({
        "action": "deposit_with_authority_created",
        "parcel_id": request.parcel_id,
        "deposit_id": record.id,
        "amount_paise": request.amount_paise,
        "reason": reason,
        "actor": request.actor,
    });
    let mut hasher = sha2::Sha256::new();
    hasher.update(prev_hash.as_bytes());
    hasher.update(payload.to_string().as_bytes());
    hasher.update(Utc::now().timestamp_nanos_opt().unwrap_or(0).to_string().as_bytes());
    let row_hash = format!("{:x}", hasher.finalize());

    let _ = sqlx::query(
        "INSERT INTO audit_log (occurred_at, tenant_id, actor_role, action, entity_type, entity_id, new_value, previous_hash, row_hash)
         VALUES (now(), '00000000-0000-0000-0000-000000000001', 'admin', 'DEPOSIT_WITH_AUTHORITY', 'deposit_with_authority', $1, $2, $3, $4)"
    )
    .bind(record.id)
    .bind(&payload)
    .bind(&prev_hash)
    .bind(&row_hash)
    .execute(pool)
    .await;

    Ok(Json(record))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReleaseDepositRequest {
    pub release_beneficiary: String,
    pub release_court_order: Option<String>,
    pub actor: Option<String>,
}

async fn release_deposit(
    State(state): State<AppState>,
    Path(deposit_id): Path<Uuid>,
    JsonBody(request): JsonBody<ReleaseDepositRequest>,
) -> Result<Json<DepositWithAuthorityRecord>, ApiError> {
    let pool = state.pool.as_ref().ok_or_else(|| ApiError::ServiceUnavailable("Database required".to_string()))?;
    use sqlx::Row;
    let row = sqlx::query(
        "UPDATE deposit_with_authority
         SET released_at = now(), release_beneficiary = $1, release_court_order = $2, status = 'released'
         WHERE id = $3 AND released_at IS NULL
         RETURNING id, parcel_id, award_id, amount_paise::bigint, deposit_reason::text, court_reference, deposited_at, released_at, release_beneficiary, status, notes"
    )
    .bind(&request.release_beneficiary)
    .bind(&request.release_court_order)
    .bind(deposit_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| ApiError::BadRequest(format!("DB error: {e}")))?
    .ok_or_else(|| ApiError::NotFound(format!("Deposit {deposit_id} not found or already released")))?;

    let record = DepositWithAuthorityRecord {
        id: row.try_get("id").unwrap_or_default(),
        parcel_id: row.try_get("parcel_id").unwrap_or_default(),
        award_id: row.try_get("award_id").ok(),
        amount_paise: row.try_get("amount_paise").unwrap_or(0),
        deposit_reason: row.try_get("deposit_reason").unwrap_or_else(|_| "disputed".to_string()),
        court_reference: row.try_get("court_reference").ok(),
        deposited_at: row.try_get("deposited_at").unwrap_or_else(|_| Utc::now()),
        released_at: row.try_get("released_at").ok(),
        release_beneficiary: row.try_get("release_beneficiary").ok(),
        status: row.try_get("status").unwrap_or_else(|_| "released".to_string()),
        notes: row.try_get("notes").ok(),
    };

    // Audit log
    let prev_hash: String = sqlx::query("SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1")
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<String, _>("row_hash").ok())
        .unwrap_or_default();
    let payload = json!({
        "action": "deposit_released",
        "deposit_id": deposit_id,
        "beneficiary": request.release_beneficiary,
        "actor": request.actor,
    });
    let mut hasher = sha2::Sha256::new();
    hasher.update(prev_hash.as_bytes());
    hasher.update(payload.to_string().as_bytes());
    hasher.update(Utc::now().timestamp_nanos_opt().unwrap_or(0).to_string().as_bytes());
    let row_hash = format!("{:x}", hasher.finalize());

    let _ = sqlx::query(
        "INSERT INTO audit_log (occurred_at, tenant_id, actor_role, action, entity_type, entity_id, new_value, previous_hash, row_hash)
         VALUES (now(), '00000000-0000-0000-0000-000000000001', 'admin', 'DEPOSIT_RELEASED', 'deposit_with_authority', $1, $2, $3, $4)"
    )
    .bind(deposit_id)
    .bind(&payload)
    .bind(&prev_hash)
    .bind(&row_hash)
    .execute(pool)
    .await;

    Ok(Json(record))
}

// Helpers
fn rand_simple(modulus: u64) -> u64 {
    (Utc::now().timestamp_nanos_opt().unwrap_or(12345678) as u64) % modulus
}

async fn visible_projects(actor: &Actor, state: &AppState) -> Result<Vec<Project>, ApiError> {
    if state.pool.is_some() {
        match state.project_repo.list_projects_async().await {
            Ok(all_projects) => {
                return Ok(all_projects
                    .into_iter()
                    .filter(|p| jurisdiction_matches(actor, p))
                    .collect());
            }
            Err(err) => {
                return Err(ApiError::ServiceUnavailable(format!("PostgreSQL database query failed: {:?}", err)));
            }
        }
    }
    let in_mem = state.in_memory.read().unwrap();
    if in_mem.projects.is_empty() {
        return Err(ApiError::ServiceUnavailable(
            "PostgreSQL database connection required. DATABASE_URL is not set or PostgreSQL is unreachable.".to_string(),
        ));
    }
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

    fn test_store() -> InMemoryStore {
        let mut store = InMemoryStore::empty();
        let employees = vec![
            ("EMP001", "Raj Sharma", "Collector", "District Administration", "COLLECTOR"),
            ("EMP002", "Amit Verma", "Revenue Officer", "Revenue Department", "REVENUE_OFFICER"),
            ("EMP003", "Neha Singh", "GIS Officer", "Survey Department", "GIS_OFFICER"),
            ("EMP004", "Ravi Kumar", "Finance Officer", "Finance Department", "FINANCE_OFFICER"),
            ("EMP005", "Suresh Patel", "Rehabilitation Officer", "R&R Department", "REHABILITATION_OFFICER"),
            ("EMP006", "Praveen Singhal", "Chief Project Officer", "Land Requiring Body (NHAI)", "LAND_REQUIRING_BODY"),
            ("EMP007", "Dr. Arvinder Roy", "SIA Officer", "Social Impact Assessment Unit", "SIA_OFFICER"),
            ("EMP008", "Harish Meena", "Additional Collector", "District Collectorate / CALA", "ADDITIONAL_COLLECTOR"),
            ("EMP009", "Adv. Madhav Joshi", "Legal Officer", "Legal & Litigation Cell", "LEGAL_OFFICER"),
            ("EMP010", "Meenakshi Sundaram", "Joint Secretary / Reviewer", "Appropriate Government / Oversight", "GOVERNMENT_REVIEWER"),
        ];
        for (emp_id, name, desig, dept, role) in employees {
            store.ehrms_employees.insert(
                emp_id.to_string(),
                EhrmsEmployee {
                    id: Uuid::new_v4().to_string(),
                    employee_id: emp_id.to_string(),
                    name: name.to_string(),
                    designation: desig.to_string(),
                    department: dept.to_string(),
                    role: role.to_string(),
                },
            );
        }

        let p_id = Uuid::parse_str("a0000000-0000-0000-0000-000000000001").unwrap();
        let w_id = Uuid::parse_str("b0000000-0000-0000-0000-000000000001").unwrap();
        let project = Project {
            id: p_id,
            name: "Delhi-Mumbai Expressway Package 14".to_string(),
            authority: Authority::Larr,
            state_code: "MH".to_string(),
            district_code: "THN".to_string(),
            stage: ProjectStage::LandRecordVerification,
            parcels: Vec::new(),
            preliminary_notification_at: None,
            updated_at: Utc::now(),
        };
        let handler = sih_workflow::who_handles_stage(&ProjectStage::LandRecordVerification);
        let workflow = WorkflowInstance {
            id: w_id,
            project_id: p_id,
            authority: Authority::Larr,
            current_stage: ProjectStage::LandRecordVerification,
            started_at: Utc::now(),
            notification_at: None,
            deadline_at: Some(Utc::now() + chrono::Duration::days(handler.timeline_days as i64)),
            completed_at: None,
            lapsed_at: None,
            responsible_department: Some(handler.department_code.to_string()),
            responsible_role: Some(handler.role_code.to_string()),
            stage_timeline_days: Some(handler.timeline_days),
        };
        store.projects.insert(p_id, project);
        store.workflows.insert(w_id, workflow);
        store.project_to_workflow.insert(p_id, w_id);

        store
    }

    #[test]
    fn test_ehrms_employees_seeded() {
        let store = test_store();
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

    #[tokio::test]
    async fn test_stage_gate_approve_and_reject_flow() {
        let store = test_store();
        let p_id = *store.projects.keys().next().unwrap();
        let w_id = store.project_to_workflow[&p_id];

        let state = AppState {
            project_repo: PgProjectRepository::new_optional(None, DEFAULT_TENANT_ID),
            parcel_repo: PgParcelRepository::new_optional(None, DEFAULT_TENANT_ID),
            auth: Arc::new(DevAuth::new("test-secret-at-least-16-bytes-long").unwrap()),
            pool: None,
            in_memory: Arc::new(RwLock::new(store)),
        };

        // 1. Initial status check
        let status = get_workflow_status(State(state.clone()), Path(w_id.to_string())).await.unwrap();
        assert_eq!(status.workflow_id, w_id);
        assert!(!status.required_documents.is_empty());

        // 2. Reject when missing mandatory documents
        let bad_approve = approve_workflow_endpoint(
            State(state.clone()),
            Path(w_id.to_string()),
            JsonBody(StageGateDecisionRequest {
                user: "EMP002".to_string(), // Revenue officer
                decision: "APPROVE".to_string(),
                remarks: Some("Approved without docs".to_string()),
                documents: vec![], // Missing required docs
            }),
        ).await;
        assert!(bad_approve.is_err());

        // 3. Reject when actor is not authorized
        let unauthorized = approve_workflow_endpoint(
            State(state.clone()),
            Path(w_id.to_string()),
            JsonBody(StageGateDecisionRequest {
                user: "EMP004".to_string(), // Finance officer trying to approve Land Verification
                decision: "APPROVE".to_string(),
                remarks: Some("Finance trying to approve land".to_string()),
                documents: vec![
                    "Cadastral Map Sheet".to_string(),
                    "Jamabandi RoR Extracts".to_string(),
                    "DILRMP Sync Record".to_string(),
                    "Title Verification Certificate".to_string(),
                ],
            }),
        ).await;
        assert!(unauthorized.is_err());

        // 4. Successful approval with authorized actor and mandatory documents
        let approve_res = approve_workflow_endpoint(
            State(state.clone()),
            Path(w_id.to_string()),
            JsonBody(StageGateDecisionRequest {
                user: "EMP002".to_string(), // Revenue officer
                decision: "APPROVE".to_string(),
                remarks: Some("Verified cadastral boundary and RoR titles".to_string()),
                documents: vec![
                    "Cadastral Map Sheet".to_string(),
                    "Jamabandi RoR Extracts".to_string(),
                    "DILRMP Sync Record".to_string(),
                    "Title Verification Certificate".to_string(),
                ],
            }),
        ).await.unwrap();

        assert!(approve_res.success);
        assert_eq!(approve_res.decision, "APPROVE");
        assert_eq!(approve_res.current_stage, ProjectStage::SiaPreparation);
        assert_eq!(approve_res.responsible_role, "sia_officer");

        // 5. Test stage rejection / return for revision
        let reject_res = reject_workflow_endpoint(
            State(state.clone()),
            Path(w_id.to_string()),
            JsonBody(json!({
                "user": "EMP001", // Collector
                "reason": "Returned for revision in baseline census",
                "remarks": "Incomplete gram panchayat census"
            })),
        ).await.unwrap();

        assert!(reject_res.success);
        assert_eq!(reject_res.decision, "REJECT");
        assert_eq!(reject_res.current_stage, ProjectStage::LandRecordVerification);
    }
}

