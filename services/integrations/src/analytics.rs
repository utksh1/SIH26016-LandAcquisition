use crate::{IntegrationError, RequestContext};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct DelayRiskRequest {
    pub context: RequestContext,
    pub pending_approvals: u32,
    pub litigation_count: u32,
    pub elapsed_days: u32,
}

impl DelayRiskRequest {
    pub fn new(
        context: RequestContext,
        pending_approvals: u32,
        litigation_count: u32,
        elapsed_days: u32,
    ) -> Self {
        Self {
            context,
            pending_approvals,
            litigation_count,
            elapsed_days,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DelayRiskLevel {
    Low,
    Medium,
    High,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct DelayRiskResult {
    pub score: u8,
    pub level: DelayRiskLevel,
    pub factors: Vec<DelayRiskFactor>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DelayRiskFactor {
    PendingApprovals,
    Litigation,
    ElapsedDays,
}

/// Seam for a delay-risk model. Inputs are aggregate counts; no external
/// source is queried and no project data is mutated.
pub trait DelayRiskPredictor: Send + Sync {
    fn predict(&self, request: &DelayRiskRequest) -> Result<DelayRiskResult, IntegrationError>;
}

/// Transparent deterministic baseline suitable for MVP screens and tests.
#[derive(Clone, Copy, Debug, Default)]
pub struct MockDelayRiskPredictor;

impl DelayRiskPredictor for MockDelayRiskPredictor {
    fn predict(&self, request: &DelayRiskRequest) -> Result<DelayRiskResult, IntegrationError> {
        request.context.validate()?;
        let score = request
            .pending_approvals
            .saturating_mul(12)
            .saturating_add(request.litigation_count.saturating_mul(20))
            .saturating_add(request.elapsed_days / 10)
            .min(100) as u8;
        let level = match score {
            0..=29 => DelayRiskLevel::Low,
            30..=59 => DelayRiskLevel::Medium,
            _ => DelayRiskLevel::High,
        };
        let mut factors = Vec::with_capacity(3);
        if request.pending_approvals > 0 {
            factors.push(DelayRiskFactor::PendingApprovals);
        }
        if request.litigation_count > 0 {
            factors.push(DelayRiskFactor::Litigation);
        }
        if request.elapsed_days > 30 {
            factors.push(DelayRiskFactor::ElapsedDays);
        }
        Ok(DelayRiskResult {
            score,
            level,
            factors,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn baseline_risk_uses_all_requested_factors() {
        let request = DelayRiskRequest::new(RequestContext::new("risk-1"), 2, 1, 50);
        let result = MockDelayRiskPredictor
            .predict(&request)
            .expect("prediction should succeed");
        assert_eq!(result.score, 49);
        assert_eq!(result.level, DelayRiskLevel::Medium);
        assert_eq!(
            result.factors,
            vec![
                DelayRiskFactor::PendingApprovals,
                DelayRiskFactor::Litigation,
                DelayRiskFactor::ElapsedDays
            ]
        );
    }

    #[test]
    fn risk_score_is_bounded_and_high_for_many_blockers() {
        let request =
            DelayRiskRequest::new(RequestContext::new("risk-2"), u32::MAX, u32::MAX, u32::MAX);
        let result = MockDelayRiskPredictor
            .predict(&request)
            .expect("prediction should succeed");
        assert_eq!(result.score, 100);
        assert_eq!(result.level, DelayRiskLevel::High);
    }
}
