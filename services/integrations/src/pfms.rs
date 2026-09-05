use crate::{IntegrationError, RequestContext};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct PfmsCompensationRequest {
    pub context: RequestContext,
    pub project_id: String,
    pub beneficiary_reference: String,
    pub amount_paise: u64,
}

impl PfmsCompensationRequest {
    pub fn new(
        context: RequestContext,
        project_id: impl Into<String>,
        beneficiary_reference: impl Into<String>,
        amount_paise: u64,
    ) -> Self {
        Self {
            context,
            project_id: project_id.into(),
            beneficiary_reference: beneficiary_reference.into(),
            amount_paise,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum PfmsPaymentStatus {
    Accepted,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct PfmsCompensationResult {
    pub idempotency_key: String,
    pub payment_reference: String,
    pub status: PfmsPaymentStatus,
    pub amount_paise: u64,
}

/// Read-only seam for a PFMS compensation submission.
pub trait PfmsCompensationGateway: Send + Sync {
    fn submit_compensation(
        &self,
        request: &PfmsCompensationRequest,
    ) -> Result<PfmsCompensationResult, IntegrationError>;
}

/// Deterministic mock PFMS adapter. It never calls a network or moves funds.
#[derive(Clone, Copy, Debug, Default)]
pub struct MockPfmsGateway;

impl PfmsCompensationGateway for MockPfmsGateway {
    fn submit_compensation(
        &self,
        request: &PfmsCompensationRequest,
    ) -> Result<PfmsCompensationResult, IntegrationError> {
        request.context.validate()?;
        if request.project_id.trim().is_empty() {
            return Err(IntegrationError::InvalidRequest(
                "project_id is required".to_string(),
            ));
        }
        if request.beneficiary_reference.trim().is_empty() {
            return Err(IntegrationError::InvalidRequest(
                "beneficiary_reference is required".to_string(),
            ));
        }
        let mut digest = Sha256::new();
        digest.update(request.context.idempotency_key.as_bytes());
        digest.update(b"|");
        digest.update(request.project_id.as_bytes());
        digest.update(b"|");
        digest.update(request.beneficiary_reference.as_bytes());
        let payment_reference = format!(
            "MOCK-PFMS-{:016x}",
            u64::from_be_bytes(
                digest.finalize()[..8]
                    .try_into()
                    .expect("digest has eight bytes"),
            )
        );
        Ok(PfmsCompensationResult {
            idempotency_key: request.context.idempotency_key.clone(),
            payment_reference,
            status: PfmsPaymentStatus::Accepted,
            amount_paise: request.amount_paise,
        })
    }
}

/// Backwards-compatible name for existing consumers of the original seam.
pub type DemoPfmsGateway = MockPfmsGateway;

#[cfg(test)]
mod tests {
    use super::*;

    fn request(key: &str) -> PfmsCompensationRequest {
        PfmsCompensationRequest::new(
            RequestContext::new(key),
            "project-1",
            "beneficiary-1",
            125_000,
        )
    }

    #[test]
    fn payment_result_is_deterministic_and_idempotent_friendly() {
        let gateway = MockPfmsGateway;
        let first = gateway
            .submit_compensation(&request("payment-1"))
            .expect("payment should succeed");
        let retry = gateway
            .submit_compensation(&request("payment-1"))
            .expect("retry should succeed");
        assert_eq!(first, retry);
        assert_eq!(first.status, PfmsPaymentStatus::Accepted);
        assert_eq!(first.amount_paise, 125_000);
        assert_eq!(first.idempotency_key, "payment-1");
    }

    #[test]
    fn payment_rejects_missing_beneficiary() {
        let request = PfmsCompensationRequest::new(RequestContext::new("payment-2"), "p", " ", 1);
        assert!(matches!(
            MockPfmsGateway.submit_compensation(&request),
            Err(IntegrationError::InvalidRequest(_))
        ));
    }
}
