use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};

use crate::models::ApiEnvelope;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[allow(dead_code)]
    #[error("Unauthorized")]
    Unauthorized,

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::BadRequest(message) => (StatusCode::BAD_REQUEST, message.clone()),
            AppError::NotFound(message) => (StatusCode::NOT_FOUND, message.clone()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".into()),
            AppError::Database(error) => {
                tracing::error!("Database error: {error}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".into(),
                )
            }
            AppError::Internal(message) => {
                tracing::error!("Internal error: {message}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".into(),
                )
            }
        };

        (status, Json(ApiEnvelope::err(message))).into_response()
    }
}
