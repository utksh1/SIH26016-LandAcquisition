use serde::{Deserialize, Serialize};
use std::{error::Error, fmt};

/// Metadata carried by every integration request.
///
/// Adapters do not mutate the key when a request is retried. This makes a
/// caller's retry safe to replay and gives external adapters a stable place
/// to apply idempotency in a production implementation.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RequestContext {
    pub idempotency_key: String,
    pub attempt: u32,
}

impl RequestContext {
    pub fn new(idempotency_key: impl Into<String>) -> Self {
        Self {
            idempotency_key: idempotency_key.into(),
            attempt: 1,
        }
    }

    /// Return the next retry attempt while preserving the idempotency key.
    pub fn retry(&self) -> Self {
        Self {
            idempotency_key: self.idempotency_key.clone(),
            attempt: self.attempt.saturating_add(1),
        }
    }

    pub fn validate(&self) -> Result<(), IntegrationError> {
        if self.idempotency_key.trim().is_empty() {
            return Err(IntegrationError::InvalidRequest(
                "idempotency_key is required".to_string(),
            ));
        }
        if self.attempt == 0 {
            return Err(IntegrationError::InvalidRequest(
                "attempt must be greater than zero".to_string(),
            ));
        }
        Ok(())
    }
}

/// Bounded retry settings for an integration job.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct RetryPolicy {
    pub max_attempts: u32,
}

impl RetryPolicy {
    pub fn new(max_attempts: u32) -> Self {
        Self {
            max_attempts: max_attempts.max(1),
        }
    }
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self::new(3)
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub enum IntegrationError {
    InvalidRequest(String),
    NotFound(String),
    Conflict(String),
    Transient(String),
}

impl IntegrationError {
    pub fn is_retryable(&self) -> bool {
        matches!(self, Self::Transient(_))
    }
}

impl fmt::Display for IntegrationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidRequest(message) => write!(f, "invalid integration request: {message}"),
            Self::NotFound(message) => write!(f, "integration record not found: {message}"),
            Self::Conflict(message) => write!(f, "integration conflict: {message}"),
            Self::Transient(message) => write!(f, "transient integration failure: {message}"),
        }
    }
}

impl Error for IntegrationError {}
