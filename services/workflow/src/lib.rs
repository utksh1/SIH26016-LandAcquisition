use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sih_domain::{Authority, Project, ProjectStage, Role};
use sqlx::{PgPool, Row};
use uuid::Uuid;

/// Canonical labels for the eight stages shown in the MVP user flow.
///
/// The persisted [`ProjectStage`] variants remain unchanged. `Sanctioned` and
/// `RrScheme` are folded into the nearest MVP phase for display, while
/// `Lapsed` remains a distinct exceptional state.
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

/// Return the canonical MVP label for a persisted workflow stage.
///
/// This is a presentation mapping only; transition and lapse rules continue to
/// operate on the original [`ProjectStage`] values.
pub fn canonical_stage_label(stage: &ProjectStage) -> &'static str {
    match stage {
        ProjectStage::Draft | ProjectStage::Sanctioned => "Project Created",
        ProjectStage::Survey => "Land Verification",
        ProjectStage::PreliminaryNotification => "Notification",
        ProjectStage::PublicHearing => "Objection Period",
        ProjectStage::CompensationAward => "Award Generation",
        ProjectStage::RrScheme | ProjectStage::FundsDisbursed => "Compensation",
        ProjectStage::Possession => "Possession",
        ProjectStage::Completed => "Completed",
        ProjectStage::Lapsed => "Lapsed",
    }
}

/// Convert an exact canonical MVP label to its representative persisted stage.
///
/// For phases containing multiple persisted stages, the returned variant is the
/// phase's entry (`Draft` for creation and `RrScheme` for compensation).
pub fn stage_from_canonical_label(label: &str) -> Option<ProjectStage> {
    match label {
        "Project Created" => Some(ProjectStage::Draft),
        "Land Verification" => Some(ProjectStage::Survey),
        "Notification" => Some(ProjectStage::PreliminaryNotification),
        "Objection Period" => Some(ProjectStage::PublicHearing),
        "Award Generation" => Some(ProjectStage::CompensationAward),
        "Compensation" => Some(ProjectStage::RrScheme),
        "Possession" => Some(ProjectStage::Possession),
        "Completed" => Some(ProjectStage::Completed),
        _ => None,
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TransitionRequest {
    pub to: ProjectStage,
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

pub fn can_transition(
    project: &Project,
    target: &ProjectStage,
    now: DateTime<Utc>,
) -> Result<TransitionDecision, GateFailure> {
    if project.stage == ProjectStage::Lapsed || project.stage == ProjectStage::Completed {
        return Err(GateFailure {
            code: "terminal_stage",
            message: "A completed or lapsed project cannot transition".to_string(),
        });
    }
    let nh_notification_lapsed = project.authority == Authority::NationalHighways
        && project.stage == ProjectStage::PreliminaryNotification
        && target != &ProjectStage::PublicHearing
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
    let allowed = match project.authority {
        Authority::Larr => matches!(
            (&project.stage, target),
            (ProjectStage::Draft, ProjectStage::Sanctioned)
                | (
                    ProjectStage::Sanctioned,
                    ProjectStage::PreliminaryNotification
                )
                | (
                    ProjectStage::PreliminaryNotification,
                    ProjectStage::PublicHearing
                )
                | (ProjectStage::PublicHearing, ProjectStage::Survey)
                | (ProjectStage::Survey, ProjectStage::CompensationAward)
                | (ProjectStage::CompensationAward, ProjectStage::RrScheme)
                | (ProjectStage::RrScheme, ProjectStage::FundsDisbursed)
                | (ProjectStage::FundsDisbursed, ProjectStage::Possession)
                | (ProjectStage::Possession, ProjectStage::Completed)
        ),
        Authority::NationalHighways => matches!(
            (&project.stage, target),
            (ProjectStage::Draft, ProjectStage::Sanctioned)
                | (
                    ProjectStage::Sanctioned,
                    ProjectStage::PreliminaryNotification
                )
                | (
                    ProjectStage::PreliminaryNotification,
                    ProjectStage::PublicHearing
                )
                | (ProjectStage::PublicHearing, ProjectStage::Survey)
                | (ProjectStage::Survey, ProjectStage::CompensationAward)
                | (
                    ProjectStage::CompensationAward,
                    ProjectStage::FundsDisbursed
                )
                | (ProjectStage::FundsDisbursed, ProjectStage::Possession)
                | (ProjectStage::Possession, ProjectStage::Completed)
        ),
    };
    if !allowed {
        return Err(GateFailure {
            code: "invalid_transition",
            message: format!("{} cannot transition to {}", project.stage, target),
        });
    }
    if *target == ProjectStage::Survey && project.parcels.is_empty() {
        return Err(GateFailure {
            code: "survey_requires_parcels",
            message: "At least one parcel is required before survey".to_string(),
        });
    }
    Ok(TransitionDecision {
        from: project.stage.clone(),
        to: target.clone(),
    })
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

pub fn required_roles(stage: &ProjectStage) -> &'static [Role] {
    match stage {
        ProjectStage::Sanctioned => &[Role::Admin, Role::RevenueOfficer],
        ProjectStage::PreliminaryNotification
        | ProjectStage::PublicHearing
        | ProjectStage::CompensationAward
        | ProjectStage::Possession => &[Role::Collector],
        ProjectStage::Survey => &[Role::Collector],
        ProjectStage::RrScheme => &[Role::Collector],
        ProjectStage::FundsDisbursed => &[Role::Admin],
        ProjectStage::Completed => &[Role::Admin, Role::Collector],
        ProjectStage::Draft | ProjectStage::Lapsed => &[],
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
    let instance = WorkflowInstance {
        id: Uuid::new_v4(),
        project_id,
        authority,
        current_stage: ProjectStage::Draft,
        started_at: Utc::now(),
        notification_at: None,
        deadline_at: None,
        completed_at: None,
        lapsed_at: None,
    };

    let authority_str = match authority {
        Authority::Larr => "larr",
        Authority::NationalHighways => "national_highways",
    };
    let stage_str = stage_to_db_code(instance.current_stage);

    sqlx::query(
        "INSERT INTO workflow_instance (id, project_id, authority, current_stage, started_at)
         VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(instance.id)
    .bind(project_id)
    .bind(authority_str)
    .bind(stage_str)
    .bind(instance.started_at)
    .execute(pool)
    .await?;

    record_timeline_event(
        pool,
        instance.id,
        "created",
        Utc::now(),
        None,
        serde_json::json!({"stage": stage_str}),
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
         FROM workflow_instance WHERE id = $1"
    )
    .bind(workflow_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| {
        let authority_str: String = r.try_get("authority").unwrap_or_else(|_| "larr".to_string());
        let stage_str: String = r.try_get("current_stage").unwrap_or_else(|_| "project_created".to_string());
        
        WorkflowInstance {
            id: r.try_get("id").unwrap_or_default(),
            project_id: r.try_get("project_id").unwrap_or_default(),
            authority: if authority_str == "national_highways" { Authority::NationalHighways } else { Authority::Larr },
            current_stage: db_code_to_stage(&stage_str),
            started_at: r.try_get("started_at").unwrap_or_else(|_| Utc::now()),
            notification_at: r.try_get("notification_at").ok(),
            deadline_at: r.try_get("deadline_at").ok(),
            completed_at: r.try_get("completed_at").ok(),
            lapsed_at: r.try_get("lapsed_at").ok(),
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
         FROM workflow_instance WHERE project_id = $1"
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| {
        let authority_str: String = r.try_get("authority").unwrap_or_else(|_| "larr".to_string());
        let stage_str: String = r.try_get("current_stage").unwrap_or_else(|_| "project_created".to_string());
        
        WorkflowInstance {
            id: r.try_get("id").unwrap_or_default(),
            project_id: r.try_get("project_id").unwrap_or_default(),
            authority: if authority_str == "national_highways" { Authority::NationalHighways } else { Authority::Larr },
            current_stage: db_code_to_stage(&stage_str),
            started_at: r.try_get("started_at").unwrap_or_else(|_| Utc::now()),
            notification_at: r.try_get("notification_at").ok(),
            deadline_at: r.try_get("deadline_at").ok(),
            completed_at: r.try_get("completed_at").ok(),
            lapsed_at: r.try_get("lapsed_at").ok(),
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
    let instance = get_workflow_instance(pool, workflow_id).await?
        .ok_or_else(|| sqlx::Error::RowNotFound)?;

    let stage_str = stage_to_db_code(to_stage);
    let now = Utc::now();

    let mut notification_at = instance.notification_at;
    if to_stage == ProjectStage::PreliminaryNotification {
        notification_at = Some(now);
    }

    let completed_at = if to_stage == ProjectStage::Completed { Some(now) } else { None };
    let lapsed_at = if to_stage == ProjectStage::Lapsed { Some(now) } else { None };

    sqlx::query(
        "UPDATE workflow_instance 
         SET current_stage = $1, notification_at = $2, completed_at = $3, lapsed_at = $4
         WHERE id = $5"
    )
    .bind(stage_str)
    .bind(notification_at)
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
        None,
        serde_json::json!({"from": stage_to_db_code(instance.current_stage), "to": stage_str}),
    )
    .await?;

    Ok(WorkflowInstance {
        current_stage: to_stage,
        notification_at,
        completed_at,
        lapsed_at,
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
    let instance = get_workflow_instance(pool, workflow_id).await?
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
        None,
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
         ORDER BY created_at ASC"
    )
    .bind(workflow_id)
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| {
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
            decision: r.try_get("decision").unwrap_or_else(|_| "advanced".to_string()),
            reason: r.try_get("reason").ok(),
            created_at: r.try_get("created_at").unwrap_or_else(|_| Utc::now()),
        }
    }).collect())
}

async fn record_approval(
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
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
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
         VALUES ($1, $2, $3, $4, $5, $6)"
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

fn stage_to_db_code(stage: ProjectStage) -> &'static str {
    match stage {
        ProjectStage::Draft => "project_created",
        ProjectStage::Sanctioned => "project_created",
        ProjectStage::Survey => "land_verification",
        ProjectStage::PreliminaryNotification => "notification",
        ProjectStage::PublicHearing => "objection_period",
        ProjectStage::CompensationAward => "award_generation",
        ProjectStage::RrScheme => "compensation",
        ProjectStage::FundsDisbursed => "compensation",
        ProjectStage::Possession => "possession",
        ProjectStage::Completed => "completed",
        ProjectStage::Lapsed => "project_created",
    }
}

fn db_code_to_stage(code: &str) -> ProjectStage {
    match code {
        "project_created" | "project_created_nh" => ProjectStage::Draft,
        "land_verification" | "land_verification_nh" => ProjectStage::Survey,
        "notification" | "notification_nh" => ProjectStage::PreliminaryNotification,
        "objection_period" | "objection_period_nh" => ProjectStage::PublicHearing,
        "award_generation" | "award_generation_nh" => ProjectStage::CompensationAward,
        "compensation" | "compensation_nh" => ProjectStage::FundsDisbursed,
        "possession" | "possession_nh" => ProjectStage::Possession,
        "completed" | "completed_nh" => ProjectStage::Completed,
        _ => ProjectStage::Draft,
    }
}

fn role_to_db_code(role: Role) -> &'static str {
    match role {
        Role::Admin => "admin",
        Role::Collector => "collector",
        Role::RevenueOfficer => "revenue_officer",
        Role::LandOwner => "land_owner",
        _ => "admin",
    }
}

fn db_code_to_role(code: &str) -> Role {
    match code {
        "admin" => Role::Admin,
        "collector" => Role::Collector,
        "revenue_officer" => Role::RevenueOfficer,
        "land_owner" => Role::LandOwner,
        _ => Role::Admin,
    }
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
            name: "Demo".to_string(),
            authority,
            state_code: "ST".to_string(),
            district_code: "DST".to_string(),
            stage,
            parcels: vec![Parcel {
                id: Uuid::new_v4(),
                survey_number: "1".to_string(),
                owner_name: "Owner".to_string(),
                area_hectares: 1.0,
                district_code: "DST".to_string(),
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
                "Notification",
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
            ProjectStage::PublicHearing,
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
