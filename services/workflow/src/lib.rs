use chrono::{DateTime, Duration, Utc};
use sih_domain::{Authority, Project, ProjectStage, Role};

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
