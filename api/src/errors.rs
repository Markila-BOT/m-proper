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

    #[error("Unauthorized")]
    Unauthorized,

    /// The access token cannot be checked right now (key-set outage). This is
    /// distinct from "the token is bad": the caller must retry, not sign out.
    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<crate::auth::AuthError> for AppError {
    fn from(error: crate::auth::AuthError) -> Self {
        match error {
            crate::auth::AuthError::InvalidToken(reason) => {
                tracing::debug!("Rejected access token: {reason}");
                AppError::Unauthorized
            }
            crate::auth::AuthError::Unavailable(reason) => AppError::ServiceUnavailable(reason),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::BadRequest(message) => (StatusCode::BAD_REQUEST, message.clone()),
            AppError::NotFound(message) => (StatusCode::NOT_FOUND, message.clone()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".into()),
            AppError::ServiceUnavailable(reason) => {
                tracing::error!("Access token verification unavailable: {reason}");
                (
                    StatusCode::SERVICE_UNAVAILABLE,
                    "Authentication is temporarily unavailable. Try again shortly.".into(),
                )
            }
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

#[cfg(test)]
mod tests {
    use axum::{body::to_bytes, http::StatusCode, response::IntoResponse};
    use serde_json::Value;

    use crate::auth::AuthError;

    use super::AppError;

    async fn body_json(response: axum::response::Response) -> Value {
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("response body should read");
        serde_json::from_slice(&bytes).expect("response body should be the JSON envelope")
    }

    #[tokio::test]
    async fn a_bad_token_is_a_401() {
        let response =
            AppError::from(AuthError::InvalidToken("bad signature".into())).into_response();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = body_json(response).await;
        assert_eq!(body["success"], false);
    }

    #[tokio::test]
    async fn an_unavailable_key_set_is_a_503() {
        let response =
            AppError::from(AuthError::Unavailable("key set unreachable".into())).into_response();

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = body_json(response).await;
        assert_eq!(body["success"], false);
        assert_eq!(
            body["message"],
            "Authentication is temporarily unavailable. Try again shortly."
        );
    }
}
