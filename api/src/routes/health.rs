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

async fn health_check(State(state): State<AppState>) -> Response {
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
