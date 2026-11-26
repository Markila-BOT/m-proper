// api/src/routes/mod.rs
pub mod health;
pub mod properties;

use axum::{
    Json, Router,
    http::{HeaderValue, StatusCode},
};
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
                .layer(cors_layer(&state.config.cors_origins)),
        )
        .with_state(state)
}

pub async fn not_found() -> (StatusCode, Json<ApiEnvelope<()>>) {
    (
        StatusCode::NOT_FOUND,
        Json(ApiEnvelope::err("Route not found")),
    )
}

fn cors_layer(origins: &[String]) -> CorsLayer {
    let allowed: Vec<HeaderValue> = origins
        .iter()
        .filter_map(|origin| match HeaderValue::from_str(origin) {
            Ok(value) => Some(value),
            Err(_) => {
                tracing::warn!("Ignoring invalid CORS origin: {origin}");
                None
            }
        })
        .collect();

    CorsLayer::new()
        .allow_origin(allowed)
        .allow_methods(Any)
        .allow_headers(Any)
}
