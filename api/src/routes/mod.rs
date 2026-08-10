// api/src/routes/mod.rs
pub mod properties;

use axum::Router;
use sqlx::PgPool;

pub fn api_router(pool: PgPool) -> Router {
    Router::new().nest("/properties", properties::router(pool))
}
