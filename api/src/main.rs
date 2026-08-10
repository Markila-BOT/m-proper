// api/src/main.rs
mod db;
mod models;
mod routes;

use axum::{routing::get, Json, Router};
use models::{ApiEnvelope, CreatePropertyRequest, Property};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::EnvFilter;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    paths(
        routes::properties::list_properties,
        routes::properties::create_property,
        routes::properties::delete_property,
    ),
    components(schemas(Property, CreatePropertyRequest)),
    tags((name = "properties", description = "Property management API"))
)]
struct ApiDoc;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse().unwrap()))
        .init();

    // Export OpenAPI document for TS client generation (does not require DB)
    if let Err(error) = export_openapi() {
        tracing::warn!("Failed to write openapi.json: {error}");
    }

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        eprintln!("DATABASE_URL is required. Copy api/.env.example to api/.env and set it.");
        std::process::exit(1);
    });

    let pool = db::connect(&database_url)
        .await
        .unwrap_or_else(|error| {
            eprintln!("Failed to connect to Postgres: {error}");
            std::process::exit(1);
        });

    db::health_check(&pool).await.unwrap_or_else(|error| {
        eprintln!("Database health check failed: {error}");
        std::process::exit(1);
    });
    tracing::info!("Connected to Postgres");

    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:3000".parse().unwrap(),
            "http://localhost:3001".parse().unwrap(),
            "http://localhost:5173".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
            "http://127.0.0.1:3001".parse().unwrap(),
            "http://127.0.0.1:5173".parse().unwrap(),
        ])
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(|| async { "m-proper api" }))
        .route(
            "/health",
            get(|| async { Json(ApiEnvelope::ok_message("ok")) }),
        )
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .merge(routes::api_router(pool))
        .layer(cors);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(3000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

fn export_openapi() -> std::io::Result<()> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("openapi.json");
    let json = ApiDoc::openapi()
        .to_pretty_json()
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
    std::fs::write(path, json)
}
