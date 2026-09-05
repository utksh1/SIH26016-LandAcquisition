use crate::{IntegrationError, RequestContext};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Read-only request to the Digital India Land Records Modernization
/// Programme (DILRMP) adapter.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct DilrmpLookupRequest {
    pub context: RequestContext,
    pub survey_number: String,
}

impl DilrmpLookupRequest {
    pub fn new(context: RequestContext, survey_number: impl Into<String>) -> Self {
        Self {
            context,
            survey_number: survey_number.into(),
        }
    }
}

/// The normalized parcel fields consumed by downstream services.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct DilrmpLandRecord {
    pub survey_number: String,
    pub owner_name: String,
    pub area_hectares: f64,
    pub ulpin: String,
}

/// Seam for a production DILRMP client. Implementations must remain read-only.
pub trait DilrmpClient: Send + Sync {
    fn lookup(&self, request: &DilrmpLookupRequest) -> Result<DilrmpLandRecord, IntegrationError>;
}

/// Deterministic, network-free DILRMP adapter for local development and tests.
#[derive(Clone, Copy, Debug, Default)]
pub struct MockDilrmpClient;

impl MockDilrmpClient {
    fn record(survey_number: &str) -> DilrmpLandRecord {
        let digest = Sha256::digest(survey_number.as_bytes());
        let seed = u64::from_be_bytes(digest[..8].try_into().expect("digest has eight bytes"));
        let area_hectares = 0.5 + f64::from((seed % 500) as u32) / 100.0;
        let ulpin = format!("{:014}", seed % 100_000_000_000_000);
        DilrmpLandRecord {
            survey_number: survey_number.to_string(),
            owner_name: format!("Mock Landowner {survey_number}"),
            area_hectares,
            ulpin,
        }
    }
}

impl DilrmpClient for MockDilrmpClient {
    fn lookup(&self, request: &DilrmpLookupRequest) -> Result<DilrmpLandRecord, IntegrationError> {
        request.context.validate()?;
        let survey_number = request.survey_number.trim();
        if survey_number.is_empty() {
            return Err(IntegrationError::InvalidRequest(
                "survey_number is required".to_string(),
            ));
        }
        Ok(Self::record(survey_number))
    }
}

/// Alias using the common adapter naming used by callers.
pub type DemoDilrmpClient = MockDilrmpClient;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lookup_is_deterministic_and_returns_normalized_fields() {
        let client = MockDilrmpClient;
        let request = DilrmpLookupRequest::new(RequestContext::new("lookup-1"), "42/7");
        let first = client.lookup(&request).expect("lookup should succeed");
        let second = client.lookup(&request).expect("lookup should succeed");
        assert_eq!(first, second);
        assert_eq!(first.survey_number, "42/7");
        assert!(first.owner_name.contains("42/7"));
        assert!(first.area_hectares > 0.0);
        assert_eq!(first.ulpin.len(), 14);
        assert!(first
            .ulpin
            .chars()
            .all(|character| character.is_ascii_digit()));
    }

    #[test]
    fn lookup_rejects_missing_survey_number() {
        let request = DilrmpLookupRequest::new(RequestContext::new("lookup-2"), " ");
        assert!(matches!(
            MockDilrmpClient.lookup(&request),
            Err(IntegrationError::InvalidRequest(_))
        ));
    }
}
