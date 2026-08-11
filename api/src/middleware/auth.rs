use axum::{extract::Request, middleware::Next, response::Response};

use crate::errors::AppError;

pub async fn require_auth(request: Request, next: Next) -> Result<Response, AppError> {
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|value| value.to_str().ok());

    match auth_header {
        Some(header) if header.starts_with("Bearer ") => Ok(next.run(request).await),
        _ => Err(AppError::Unauthorized),
    }
}
