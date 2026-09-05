use chrono::{DateTime, Utc};
use sih_domain::{Project, ProjectRepository};
use sih_integrations::{
    DelayRiskPredictor, DelayRiskRequest, DelayRiskResult, IntegrationError, RequestContext,
};
use sih_workflow::lapse_if_due;
use std::sync::Arc;

/// Runs statutory housekeeping, including National Highways one-year lapse checks.
pub fn process_lapses(repository: Arc<dyn ProjectRepository>) -> usize {
    let mut updated = 0;
    for mut project in repository.list_projects() {
        if lapse_if_due(&mut project, Utc::now()) {
            repository.save_project(project);
            updated += 1;
        }
    }
    updated
}

pub fn lapse_project(project: &mut Project) -> bool {
    lapse_if_due(project, Utc::now())
}

/// Input snapshot used by a scheduled delay-risk job. Aggregates are supplied
/// by the owning domain service; this crate does not query or mutate a store.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DelayRiskJobInput {
    pub project_id: String,
    pub pending_approvals: u32,
    pub litigation_count: u32,
    pub started_at: DateTime<Utc>,
}

impl DelayRiskJobInput {
    pub fn elapsed_days(&self, now: DateTime<Utc>) -> u32 {
        now.signed_duration_since(self.started_at).num_days().max(0) as u32
    }
}

/// Executes one deterministic prediction using the integration seam.
pub fn predict_delay_risk<P: DelayRiskPredictor>(
    predictor: &P,
    input: &DelayRiskJobInput,
    context: RequestContext,
    now: DateTime<Utc>,
) -> Result<DelayRiskResult, IntegrationError> {
    predictor.predict(&DelayRiskRequest::new(
        context,
        input.pending_approvals,
        input.litigation_count,
        input.elapsed_days(now),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;
    use sih_integrations::{DelayRiskLevel, MockDelayRiskPredictor};

    #[test]
    fn delay_risk_job_computes_elapsed_days() {
        let started_at = Utc::now() - Duration::days(45);
        let input = DelayRiskJobInput {
            project_id: "project-1".to_string(),
            pending_approvals: 1,
            litigation_count: 1,
            started_at,
        };
        let result = predict_delay_risk(
            &MockDelayRiskPredictor,
            &input,
            RequestContext::new("risk-job-1"),
            Utc::now(),
        )
        .expect("prediction should succeed");
        assert_eq!(result.level, DelayRiskLevel::Medium);
        assert!(result.score >= 30);
    }
}
