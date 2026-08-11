// api/src/main.rs
mod config;
mod db;
mod errors;
mod extractors;
mod middleware;
mod models;
mod routes;
mod state;

use config::Config;
use models::{CreatePropertyRequest, Property};
use std::net::SocketAddr;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
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

    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,tower_http=debug".into()))
        .init();

    // Export OpenAPI document for TS client generation (does not require DB)
    if let Err(error) = export_openapi() {
        tracing::warn!("Failed to write openapi.json: {error}");
    }

    let config = Config::from_env().unwrap_or_else(|error| {
        eprintln!("{error}. Copy api/.env.example to api/.env and set it.");
        std::process::exit(1);
    });

    let state = state::AppState::new(config).await.unwrap_or_else(|error| {
        eprintln!("Failed to connect to Postgres: {error}");
        std::process::exit(1);
    });

    db::health_check(&state.pool).await.unwrap_or_else(|error| {
        eprintln!("Database health check failed: {error}");
        std::process::exit(1);
    });
    tracing::info!("Connected to Postgres");

    sqlx::migrate!("./migrations")
        .run(&state.pool)
        .await
        .unwrap_or_else(|error| {
            eprintln!("Failed to run migrations: {error}");
            std::process::exit(1);
        });

    let port = state.config.port;
    let app = routes::create_router(state)
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .fallback(routes::not_found);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap_or_else(|error| {
            panic!("Failed to bind {addr}: {error}");
        });
    axum::serve(listener, app).await.unwrap();
}

fn export_openapi() -> std::io::Result<()> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("openapi.json");
    let json = ApiDoc::openapi()
        .to_pretty_json()
        .map_err(std::io::Error::other)?;

    if std::fs::read_to_string(&path).is_ok_and(|existing| existing == json) {
        return Ok(());
    }

    std::fs::write(path, json)
}
