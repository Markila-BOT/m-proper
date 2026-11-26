use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};

use crate::{db, models::ApiEnvelope, state::AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
}

async fn root() -> &'static str {
    "m-proper api"
}

/// Liveness probe; answers 503 when the database is unreachable.
///
/// `security()` keeps the global bearer requirement off this route: the probe
/// must answer before a caller can hold a token.
#[utoipa::path(
    get,
    path = "/health",
    security(),
    responses(
        (status = 200, description = "ok", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 503, description = "Database unreachable", body = ApiEnvelope<utoipa::TupleUnit>)
    ),
    tag = "health"
)]
pub async fn health_check(State(state): State<AppState>) -> Response {
    match db::health_check(&state.pool).await {
        Ok(()) => Json(ApiEnvelope::ok_message("ok")).into_response(),
        Err(error) => {
            tracing::error!("Database unreachable: {error}");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(ApiEnvelope::err("Database unreachable")),
            )
                .into_response()
        }
    }
}
