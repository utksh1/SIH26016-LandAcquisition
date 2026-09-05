//! Typed, network-free integration seams for the SIH26016 MVP.
//!
//! The adapters in this crate intentionally do not perform external I/O. They
//! provide deterministic behavior for local development while their traits
//! leave a narrow seam for read-only production clients.

pub mod analytics;
pub mod common;
pub mod dilrmp;
pub mod document;
pub mod pfms;

pub use analytics::{
    DelayRiskFactor, DelayRiskLevel, DelayRiskPredictor, DelayRiskRequest, DelayRiskResult,
    MockDelayRiskPredictor,
};
pub use common::{IntegrationError, RequestContext, RetryPolicy};
pub use dilrmp::{
    DemoDilrmpClient, DilrmpClient, DilrmpLandRecord, DilrmpLookupRequest, MockDilrmpClient,
};
pub use document::{
    DocumentExtractionRequest, DocumentExtractionResult, DocumentExtractor, ExtractionSource,
    FileMetadata, MockDocumentExtractor,
};
pub use pfms::{
    MockPfmsGateway, PfmsCompensationGateway, PfmsCompensationRequest, PfmsCompensationResult,
    PfmsPaymentStatus,
};

use serde::{Deserialize, Serialize};

/// Legacy PFMS request retained for callers of the original integration seam.
/// New code should use [`PfmsCompensationRequest`], which carries an
/// idempotency key and retry attempt.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct PfmsPaymentRequest {
    pub project_id: String,
    pub beneficiary_reference: String,
    pub amount_paise: u64,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct PfmsPaymentResponse {
    pub reference: String,
    pub status: String,
}

/// Compatibility seam for the original PFMS adapter.
///
/// The richer, fallible seam is [`PfmsCompensationGateway`] in the `pfms`
/// module. This trait remains infallible so existing MVP callers continue to
/// compile while the new interface can model validation and retryable errors.
pub trait PfmsGateway: Send + Sync {
    fn submit_payment(&self, request: &PfmsPaymentRequest) -> PfmsPaymentResponse;
}

/// Compatibility alias for the original deterministic demo gateway.
pub type DemoPfmsGateway = MockPfmsGateway;

impl PfmsGateway for MockPfmsGateway {
    fn submit_payment(&self, request: &PfmsPaymentRequest) -> PfmsPaymentResponse {
        PfmsPaymentResponse {
            reference: format!("DEMO-{}", request.project_id),
            status: "accepted".to_string(),
        }
    }
}
