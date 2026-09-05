use axum::{
    body::to_bytes,
    extract::{FromRequest, FromRequestParts, Path, Request, State},
    http::{header, request::Parts, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sih_domain::{
    Actor, AuditEntry, AuditRepository, Authority, Jurisdiction, Permission, Project, ProjectId,
    ProjectRepository, ProjectStage, Role,
};
use sih_workflow::can_transition;
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
const DEMO_AUTH_SECRET: &str = "sih-local-demo-secret-change-me";

#[derive(Default)]
pub struct InMemoryRepository {
    projects: RwLock<HashMap<ProjectId, Project>>,
    audit: RwLock<Vec<AuditEntry>>,
}

impl InMemoryRepository {
    pub fn demo() -> Arc<Self> {
        let repository = Arc::new(Self::default());
        let project = Project {
            id: Uuid::new_v4(),
            name: "NH-48 Expansion Demo".to_string(),
            authority: Authority::NationalHighways,
            state_code: "KA".to_string(),
            district_code: "BLR".to_string(),
            stage: ProjectStage::Draft,
            parcels: Vec::new(),
            preliminary_notification_at: None,
            updated_at: Utc::now(),
        };
        repository.save_project(project);
        repository
    }
}

impl ProjectRepository for InMemoryRepository {
    fn list_projects(&self) -> Vec<Project> {
        self.projects
            .read()
            .expect("repository lock poisoned")
            .values()
            .cloned()
            .collect()
    }

    fn get_project(&self, id: ProjectId) -> Option<Project> {
        self.projects
            .read()
            .expect("repository lock poisoned")
            .get(&id)
            .cloned()
    }

    fn save_project(&self, project: Project) {
        self.projects
            .write()
            .expect("repository lock poisoned")
            .insert(project.id, project);
    }
}

impl AuditRepository for InMemoryRepository {
    fn append_audit(&self, entry: AuditEntry) {
        self.audit
            .write()
            .expect("repository lock poisoned")
            .push(entry);
    }

    fn list_audit(&self) -> Vec<AuditEntry> {
        self.audit.read().expect("repository lock poisoned").clone()
    }
}

/// Database-backed repositories can be introduced by implementing these same traits. HTTP handlers
/// depend only on this seam, so replacing the demo store does not change the API surface.
pub trait Repository: ProjectRepository + AuditRepository {}
impl<T: ProjectRepository + AuditRepository> Repository for T {}

/// A signed, development-only bearer-token verifier.
///
/// This is deliberately not presented as JWT, SSO, or production authentication. A deployment must
/// replace this seam with its own identity provider before it is used outside local development.
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

    /// Issue a short-lived local token for an already-authenticated development actor.
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
        let encoded_payload = encoded_payload.expect("checked above");
        let encoded_signature = encoded_signature.expect("checked above");
        let signature = decode_base64url(encoded_signature).ok_or_else(|| {
            ApiError::Unauthorized("invalid development token signature".to_string())
        })?;
        let signing_input = format!("{DEV_TOKEN_VERSION}.{encoded_payload}");
        let expected = hmac_sha256(&self.secret, signing_input.as_bytes());
        if !constant_time_equal(&signature, &expected) {
            return Err(ApiError::Unauthorized(
                "invalid development token signature".to_string(),
            ));
        }
        let payload = decode_base64url(encoded_payload).ok_or_else(|| {
            ApiError::Unauthorized("invalid development token payload".to_string())
        })?;
        let claims: DevClaims = serde_json::from_slice(&payload)
            .map_err(|_| ApiError::Unauthorized("invalid development token payload".to_string()))?;
        if claims.exp <= Utc::now().timestamp() {
            return Err(ApiError::Unauthorized(
                "development token has expired".to_string(),
            ));
        }
        if !is_supported_role(claims.actor.role) {
            return Err(ApiError::Unauthorized(
                "development token contains an unsupported role".to_string(),
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

#[derive(Clone)]
pub struct AppState {
    pub repository: Arc<dyn Repository>,
    pub auth: Arc<DevAuth>,
}

impl AppState {
    /// Local test/demo state. The predictable secret is intentionally only for this in-process seam.
    pub fn demo() -> Self {
        Self::with_repository(
            InMemoryRepository::demo(),
            DevAuth::new(DEMO_AUTH_SECRET).expect("demo auth secret is valid"),
        )
    }

    pub fn from_env() -> Result<Self, String> {
        let secret = env::var("SIH_DEV_AUTH_SECRET")
            .map_err(|_| "SIH_DEV_AUTH_SECRET must be set for the API server".to_string())?;
        Self::with_repository_result(InMemoryRepository::demo(), DevAuth::new(secret))
    }

    pub fn with_repository(repository: Arc<dyn Repository>, auth: DevAuth) -> Self {
        Self {
            repository,
            auth: Arc::new(auth),
        }
    }

    fn with_repository_result(
        repository: Arc<dyn Repository>,
        auth: Result<DevAuth, String>,
    ) -> Result<Self, String> {
        Ok(Self::with_repository(repository, auth?))
    }
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
        let authorization = parts.headers.get(header::AUTHORIZATION).ok_or_else(|| {
            ApiError::Unauthorized("authorization header is required".to_string())
        })?;
        state.auth.authenticate(authorization).map(Self)
    }
}

/// JSON extractor that keeps malformed and oversized request failures in the API's JSON error
/// envelope instead of returning framework-specific plain text.
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
        .route("/audit", get(list_audit))
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

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub authority: Authority,
    pub state_code: String,
    pub district_code: String,
}

#[derive(Debug, Deserialize)]
pub struct TransitionRequest {
    pub to: ProjectStage,
    /// Accepted only for wire compatibility. Authorization always uses the bearer actor.
    #[serde(default)]
    pub actor: Option<Actor>,
}

#[derive(Debug, Serialize)]
pub struct Dashboard {
    pub total_projects: usize,
    pub by_stage: HashMap<String, usize>,
}

async fn health() -> Json<Value> {
    Json(json!({"status": "ok", "service": "sih26016-api"}))
}

async fn readiness(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let _ = state.repository.list_projects();
    Ok(Json(json!({
        "status": "ready",
        "service": "sih26016-api",
        "authentication": "development_signed_token"
    })))
}

async fn dashboard(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
) -> Result<Json<Dashboard>, ApiError> {
    require_permission(&actor, Permission::ViewProjects)?;
    let projects = visible_projects(&actor, &state);
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
    Ok(Json(visible_projects(&actor, &state)))
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
    if request.name.chars().count() > 200
        || request.state_code.chars().count() > 32
        || request.district_code.chars().count() > 64
    {
        return Err(ApiError::BadRequest(
            "project fields exceed their size limits".to_string(),
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
    state.repository.save_project(project.clone());
    append_audit(
        &state,
        actor.id,
        "project_created",
        format!("project/{}", project.id),
        json!({"stage": "draft"}),
    );
    Ok((StatusCode::CREATED, Json(project)))
}

async fn get_project(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    id: Result<Path<ProjectId>, axum::extract::rejection::PathRejection>,
) -> Result<Json<Project>, ApiError> {
    let Path(id) = id.map_err(|_| ApiError::BadRequest("project id must be a UUID".to_string()))?;
    require_permission(&actor, Permission::ViewProjects)?;
    let project = state
        .repository
        .get_project(id)
        .ok_or_else(|| ApiError::NotFound("project not found".to_string()))?;
    authorize_project_access(&actor, &project)?;
    Ok(Json(project))
}

async fn transition(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
    id: Result<Path<ProjectId>, axum::extract::rejection::PathRejection>,
    JsonBody(request): JsonBody<TransitionRequest>,
) -> Result<Json<Project>, ApiError> {
    let Path(id) = id.map_err(|_| ApiError::BadRequest("project id must be a UUID".to_string()))?;
    require_permission(&actor, Permission::TransitionProjects)?;
    let project = state
        .repository
        .get_project(id)
        .ok_or_else(|| ApiError::NotFound("project not found".to_string()))?;
    authorize_transition_for_project(&actor, &project, &request.to)?;
    let decision = can_transition(&project, &request.to, Utc::now())
        .map_err(|failure| ApiError::Conflict(failure.message))?;
    let mut project = project;
    project.stage = decision.to.clone();
    project.updated_at = Utc::now();
    if project.stage == ProjectStage::PreliminaryNotification {
        project.preliminary_notification_at = Some(project.updated_at);
    }
    state.repository.save_project(project.clone());
    append_audit(
        &state,
        actor.id,
        "project_transitioned",
        format!("project/{}", project.id),
        json!({"from": decision.from, "to": decision.to}),
    );
    Ok(Json(project))
}

async fn list_audit(
    AuthenticatedActor(actor): AuthenticatedActor,
    State(state): State<AppState>,
) -> Result<Json<Vec<AuditEntry>>, ApiError> {
    require_permission(&actor, Permission::ViewAudit)?;
    if !matches!(
        (&actor.role, &actor.jurisdiction),
        (Role::Admin, Jurisdiction::National)
    ) {
        return Err(ApiError::Forbidden(
            "audit access requires an admin with national jurisdiction".to_string(),
        ));
    }
    Ok(Json(state.repository.list_audit()))
}

fn append_audit(state: &AppState, actor_id: Uuid, action: &str, resource: String, payload: Value) {
    let entries = state.repository.list_audit();
    let previous_hash = entries
        .last()
        .map(|entry| entry.hash.clone())
        .unwrap_or_default();
    let entry = AuditEntry::new(
        entries.len() as u64 + 1,
        actor_id,
        action,
        resource,
        payload,
        previous_hash,
    );
    state.repository.append_audit(entry);
}

fn is_supported_role(role: Role) -> bool {
    matches!(
        role,
        Role::Admin | Role::Collector | Role::RevenueOfficer | Role::LandOwner
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
        (Role::Admin, Jurisdiction::National) => true,
        (Role::RevenueOfficer, Jurisdiction::State { code }) => code == state_code,
        (Role::Collector, Jurisdiction::District { code }) => code == district_code,
        (
            Role::Collector,
            Jurisdiction::Field {
                district_code: code,
            },
        ) => code == district_code,
        (Role::LandOwner, Jurisdiction::Public) => false,
        _ => false,
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
        (Role::Admin, Jurisdiction::National) => true,
        (Role::RevenueOfficer, Jurisdiction::State { code }) => code == &project.state_code,
        (Role::Collector, Jurisdiction::District { code }) => code == &project.district_code,
        (Role::Collector, Jurisdiction::Field { district_code }) => {
            district_code == &project.district_code
        }
        (Role::LandOwner, Jurisdiction::Public) => true,
        _ => false,
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

fn visible_projects(actor: &Actor, state: &AppState) -> Vec<Project> {
    state
        .repository
        .list_projects()
        .into_iter()
        .filter(|project| jurisdiction_matches(actor, project))
        .collect()
}

pub fn authorize_transition(actor: &Actor, target: &ProjectStage) -> Result<(), ApiError> {
    require_permission(actor, Permission::TransitionProjects)?;
    let role_allowed = match (&actor.role, target) {
        (
            Role::Admin,
            ProjectStage::Sanctioned | ProjectStage::FundsDisbursed | ProjectStage::Completed,
        ) => true,
        (Role::RevenueOfficer, ProjectStage::Sanctioned) => true,
        (
            Role::Collector,
            ProjectStage::PreliminaryNotification
            | ProjectStage::PublicHearing
            | ProjectStage::CompensationAward
            | ProjectStage::Possession
            | ProjectStage::Survey
            | ProjectStage::RrScheme
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
    matches!(
        (&actor.role, &actor.jurisdiction),
        (Role::Admin, Jurisdiction::National)
            | (Role::RevenueOfficer, Jurisdiction::State { .. })
            | (Role::Collector, Jurisdiction::District { .. })
            | (Role::Collector, Jurisdiction::Field { .. })
    )
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
    use axum::body::Body;
    use axum::http::Request;
    use sih_domain::{verify_audit_chain, AuditRepository, ProjectRepository};
    use tower::ServiceExt;

    fn actor(role: Role, jurisdiction: Jurisdiction) -> Actor {
        Actor {
            id: Uuid::new_v4(),
            role,
            jurisdiction,
        }
    }

    fn bearer(state: &AppState, actor: Actor) -> HeaderValue {
        HeaderValue::from_str(&format!("Bearer {}", state.auth.issue_token_for(actor)))
            .expect("token is a valid header")
    }

    #[test]
    fn authorization_rejects_wrong_role() {
        let citizen = actor(Role::LandOwner, Jurisdiction::Public);
        assert!(authorize_transition(&citizen, &ProjectStage::Sanctioned).is_err());
    }

    #[test]
    fn authorization_accepts_district_collector() {
        let collector = actor(
            Role::Collector,
            Jurisdiction::District {
                code: "BLR".to_string(),
            },
        );
        assert!(authorize_transition(&collector, &ProjectStage::PublicHearing).is_ok());
    }

    #[test]
    fn signed_development_tokens_round_trip_and_reject_tampering() {
        let auth = DevAuth::new("a-development-secret").expect("secret is long enough");
        let actor = actor(Role::Admin, Jurisdiction::National);
        let token = auth.issue_token_for(actor.clone());
        let header = HeaderValue::from_str(&format!("Bearer {token}")).expect("header is valid");
        assert_eq!(auth.authenticate(&header).expect("token verifies"), actor);
        let tampered = HeaderValue::from_str(&format!("Bearer {token}x")).expect("header is valid");
        assert!(auth.authenticate(&tampered).is_err());
    }

    #[tokio::test]
    async fn app_exposes_health_and_readiness_without_authentication() {
        let service = app(AppState::demo());
        let response = service
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .expect("request builds"),
            )
            .await
            .expect("health response");
        assert_eq!(response.status(), StatusCode::OK);
        assert!(response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .starts_with("application/json"));

        let response = service
            .oneshot(
                Request::builder()
                    .uri("/ready")
                    .body(Body::empty())
                    .expect("request builds"),
            )
            .await
            .expect("readiness response");
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn protected_routes_require_a_structured_authentication_error() {
        let response = app(AppState::demo())
            .oneshot(
                Request::builder()
                    .uri("/projects")
                    .body(Body::empty())
                    .expect("request builds"),
            )
            .await
            .expect("projects response");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = axum::body::to_bytes(response.into_body(), MAX_BODY_BYTES)
            .await
            .expect("error body");
        let parsed: ErrorBody = serde_json::from_slice(&body).expect("structured error");
        assert_eq!(parsed.error.code, "unauthorized");
    }

    #[tokio::test]
    async fn authenticated_actor_is_used_instead_of_body_actor() {
        let state = AppState::demo();
        let collector = actor(
            Role::Collector,
            Jurisdiction::District {
                code: "BLR".to_string(),
            },
        );
        let body = json!({
            "to": "preliminary_notification",
            "actor": actor(Role::Admin, Jurisdiction::National)
        });
        let response = app(state.clone())
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/projects/not-a-uuid/transition")
                    .header(header::AUTHORIZATION, bearer(&state, collector))
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(body.to_string()))
                    .expect("request builds"),
            )
            .await
            .expect("transition response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn demo_audit_store_starts_with_empty_valid_chain() {
        let repository = InMemoryRepository::demo();
        assert!(verify_audit_chain(&repository.list_audit()));
        assert!(repository.list_projects().len() >= 1);
    }
}
