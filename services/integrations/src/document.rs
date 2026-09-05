use crate::{IntegrationError, RequestContext};
use serde::{Deserialize, Serialize};

/// Input for extraction from either supplied text or file metadata. The mock
/// never reads or uploads a file; metadata is enough for deterministic tests.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct DocumentExtractionRequest {
    pub context: RequestContext,
    pub text: Option<String>,
    pub file: Option<FileMetadata>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct FileMetadata {
    pub file_name: String,
    pub media_type: Option<String>,
    pub size_bytes: Option<u64>,
}

impl DocumentExtractionRequest {
    pub fn from_text(context: RequestContext, text: impl Into<String>) -> Self {
        Self {
            context,
            text: Some(text.into()),
            file: None,
        }
    }

    pub fn from_file(context: RequestContext, file: FileMetadata) -> Self {
        Self {
            context,
            text: None,
            file: Some(file),
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct DocumentExtractionResult {
    pub survey_number: Option<String>,
    pub owner_name: Option<String>,
    pub area_hectares: Option<f64>,
    pub source: ExtractionSource,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ExtractionSource {
    Text,
    FileMetadata,
}

/// Seam for an OCR/document extraction service.
pub trait DocumentExtractor: Send + Sync {
    fn extract(
        &self,
        request: &DocumentExtractionRequest,
    ) -> Result<DocumentExtractionResult, IntegrationError>;
}

/// Simple deterministic extractor supporting labelled text and file metadata.
#[derive(Clone, Copy, Debug, Default)]
pub struct MockDocumentExtractor;

impl MockDocumentExtractor {
    fn labelled_value<'a>(text: &'a str, labels: &[&str]) -> Option<&'a str> {
        text.lines().find_map(|line| {
            let (label, value) = line.split_once(':')?;
            labels
                .iter()
                .any(|candidate| label.trim().eq_ignore_ascii_case(candidate))
                .then_some(value.trim())
                .filter(|value| !value.is_empty())
        })
    }

    fn text_result(text: &str) -> DocumentExtractionResult {
        let area_hectares = Self::labelled_value(text, &["area", "area_hectares", "area hectares"])
            .and_then(|value| value.parse::<f64>().ok());
        DocumentExtractionResult {
            survey_number: Self::labelled_value(
                text,
                &["survey", "survey_number", "survey number"],
            )
            .map(str::to_owned),
            owner_name: Self::labelled_value(text, &["owner", "owner_name"]).map(str::to_owned),
            area_hectares,
            source: ExtractionSource::Text,
        }
    }
}

impl DocumentExtractor for MockDocumentExtractor {
    fn extract(
        &self,
        request: &DocumentExtractionRequest,
    ) -> Result<DocumentExtractionResult, IntegrationError> {
        request.context.validate()?;
        match (request.text.as_deref(), request.file.as_ref()) {
            (Some(text), _) if !text.trim().is_empty() => Ok(Self::text_result(text)),
            (None, Some(file)) if !file.file_name.trim().is_empty() => {
                // A file is deliberately not opened. Return an explicit empty
                // extraction until a production OCR adapter is configured.
                Ok(DocumentExtractionResult {
                    survey_number: None,
                    owner_name: None,
                    area_hectares: None,
                    source: ExtractionSource::FileMetadata,
                })
            }
            _ => Err(IntegrationError::InvalidRequest(
                "document text or file metadata is required".to_string(),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_labelled_fields_from_text() {
        let request = DocumentExtractionRequest::from_text(
            RequestContext::new("document-1"),
            "Owner: Asha Rao\nSurvey Number: 17/2\nArea Hectares: 1.75",
        );
        let result = MockDocumentExtractor
            .extract(&request)
            .expect("extraction should succeed");
        assert_eq!(result.survey_number.as_deref(), Some("17/2"));
        assert_eq!(result.owner_name.as_deref(), Some("Asha Rao"));
        assert_eq!(result.area_hectares, Some(1.75));
        assert_eq!(result.source, ExtractionSource::Text);
    }

    #[test]
    fn file_metadata_is_accepted_without_file_io() {
        let request = DocumentExtractionRequest::from_file(
            RequestContext::new("document-2"),
            FileMetadata {
                file_name: "award.pdf".to_string(),
                media_type: Some("application/pdf".to_string()),
                size_bytes: Some(512),
            },
        );
        let result = MockDocumentExtractor
            .extract(&request)
            .expect("metadata should succeed");
        assert_eq!(result.source, ExtractionSource::FileMetadata);
        assert!(result.survey_number.is_none());
    }
}
