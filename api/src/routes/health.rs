use axum::{Json, Router, routing::get};

use crate::{models::ApiEnvelope, state::AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
}

async fn root() -> &'static str {
    "m-proper api"
}

async fn health_check() -> Json<ApiEnvelope<()>> {
    Json(ApiEnvelope::ok_message("ok"))
}
