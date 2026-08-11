// api/src/routes/mod.rs
mod health;
pub mod properties;

use axum::{Json, Router, http::StatusCode};
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use crate::{models::ApiEnvelope, state::AppState};

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .merge(health::router())
        .nest("/properties", properties::router())
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CompressionLayer::new())
                .layer(cors_layer()),
        )
        .with_state(state)
}

pub async fn not_found() -> (StatusCode, Json<ApiEnvelope<()>>) {
    (
        StatusCode::NOT_FOUND,
        Json(ApiEnvelope::err("Route not found")),
    )
}

fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin([
            "http://localhost:3000".parse().unwrap(),
            "http://localhost:3001".parse().unwrap(),
            "http://localhost:5173".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
            "http://127.0.0.1:3001".parse().unwrap(),
            "http://127.0.0.1:5173".parse().unwrap(),
        ])
        .allow_methods(Any)
        .allow_headers(Any)
}
