use axum::Json;
use serde::Serialize;
use serde_json::json;
use sqlx::Error as SqlxError;
use std::collections::HashMap;
use thiserror::Error;
use tracing::{debug, error};
use validator::ValidationErrors;

#[derive(Serialize)]
struct ErrorResponse {
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<serde_json::Value>,
}

// TODO: Implement error handling for API
#[derive(Debug, Error)]
pub enum ApiError {
    #[error("Validation error")]
    CustomValidation(HashMap<String, String>),
    #[error("Database error: {0}")]
    Database(#[from] SqlxError),
    #[error("Internal server error")]
    InternalServerError,
    //#[error("Not found")]
    //NotFound,
    #[error("Invalid request: {0}")]
    BadRequest(String),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Validation error: {0}")]
    Validation(#[from] ValidationErrors),
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Conflict")]
    Conflict,
}

impl From<HashMap<String, String>> for ApiError {
    fn from(errors: HashMap<String, String>) -> Self {
        ApiError::CustomValidation(errors)
    }
}

impl axum::response::IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, error_response) = match self {
            ApiError::CustomValidation(ref errors) => (
                axum::http::StatusCode::UNPROCESSABLE_ENTITY,
                Json(ErrorResponse {
                    code: "VALIDATION_ERROR".into(),
                    message: "Invalid input data".into(),
                    details: Some(json!(errors)),
                }),
            ),
            ApiError::Database(ref e) => {
                // Handle specific database errors
                // Log the full error and code for debugging
                if let sqlx::Error::Database(db_err) = e {
                    error!(
                        "Database error occurred: {:?}, Code: {:?}",
                        e,
                        db_err.code()
                    );

                    // For AGE's "already exists" error
                    if db_err.message().contains("already exists") {
                        return (
                            axum::http::StatusCode::CONFLICT,
                            Json(ErrorResponse {
                                code: "LABEL_ALREADY_EXISTS".into(),
                                message: "The specified label already exists".into(),
                                details: None,
                            }),
                        )
                            .into_response();
                    }
                }
                // Default database error response
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        code: "INTERNAL_SERVER_ERROR".into(),
                        message: "An internal server error occurred".into(),
                        details: None, // Don't expose internal error details
                    }),
                )
            }
            ApiError::BadRequest(ref msg) => (
                axum::http::StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    code: "BAD_REQUEST".into(),
                    message: msg.clone(),
                    details: None,
                }),
            ),
            ApiError::Serialization(ref e) => {
                error!("Failed to serialize data: {}", e);
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        code: "SERIALIZATION_ERROR".into(),
                        message: "Failed to process data".into(),
                        details: None,
                    }),
                )
            }
            ApiError::Validation(ref e) => {
                debug!("Validation error: {}", e.to_string().replace("\n", "; "));
                let details: Vec<serde_json::Value> = e
                    .field_errors()
                    .iter()
                    .flat_map(|(field, errors)| {
                        errors.iter().map(move |error| {
                            let msg = error
                                .message
                                .clone()
                                .unwrap_or_else(|| std::borrow::Cow::from(error.code.clone()));
                            serde_json::Value::String(format!("{}: {}", field, msg))
                        })
                    })
                    .collect();

                (
                    axum::http::StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        code: "VALIDATION_ERROR".into(),
                        message: "Invalid input data".into(),
                        details: Some(serde_json::Value::Array(details)),
                    }),
                )
            }
            ApiError::InternalServerError => (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    code: "INTERNAL_SERVER_ERROR".into(),
                    message: "An internal server error occurred".into(),
                    details: None,
                }),
            ),
            ApiError::Unauthorized => (
                axum::http::StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    code: "UNAUTHORIZED".into(),
                    message: "Unauthorized".into(),
                    details: None,
                }),
            ),
            ApiError::Conflict => (
                axum::http::StatusCode::CONFLICT,
                Json(ErrorResponse {
                    code: "CONFLICT".into(),
                    message: "Conflict".into(),
                    details: None,
                }),
            ),
        };

        (status, error_response).into_response()
    }
}
