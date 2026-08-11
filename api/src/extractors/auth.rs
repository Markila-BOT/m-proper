use axum::{extract::FromRequestParts, http::request::Parts};
use uuid::Uuid;

use crate::{errors::AppError, state::AppState};

pub struct AuthenticatedUser {
    pub user_id: Uuid,
}

impl FromRequestParts<AppState> for AuthenticatedUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|value| value.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AppError::Unauthorized)?;

        let user_id = validate_token(token)?;

        Ok(Self { user_id })
    }
}

fn validate_token(token: &str) -> Result<Uuid, AppError> {
    let _ = token;
    Err(AppError::Unauthorized)
}
