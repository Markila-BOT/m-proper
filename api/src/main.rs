// api/src/main.rs
mod auth;
mod config;
mod db;
mod errors;
mod extractors;
mod models;
mod routes;
mod state;

use config::Config;
use models::{ApiEnvelope, CreatePropertyRequest, Property};
use std::net::SocketAddr;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::{
    Modify, OpenApi,
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
};
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    paths(
        routes::properties::list_properties,
        routes::properties::create_property,
        routes::properties::delete_property_without_id,
        routes::properties::delete_property,
        routes::health::health_check,
    ),
    components(schemas(
        Property,
        CreatePropertyRequest,
        ApiEnvelope::<Vec<Property>>,
        ApiEnvelope::<Property>,
        ApiEnvelope::<utoipa::TupleUnit>,
    )),
    modifiers(&BearerAuth),
    security(("bearer_auth" = [])),
    tags(
        (name = "properties", description = "Property management API"),
        (name = "health", description = "Liveness and database reachability")
    )
)]
struct ApiDoc;

/// Declares the bearer scheme the API verifies. utoipa 6 has no security-scheme
/// support in `components(...)`, so the scheme is added by a `Modify` addon.
struct BearerAuth;

impl Modify for BearerAuth {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);
        components.add_security_scheme(
            "bearer_auth",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("JWT")
                    .description(Some(
                        "Supabase access token. Send it as `Authorization: Bearer <token>`.",
                    ))
                    .build(),
            ),
        );
    }
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,tower_http=debug".into()))
        .init();

    // Export OpenAPI document for TS client generation (does not require DB).
    // `--dump-openapi` stops here so the document can be exported without a
    // database or a bound port.
    if std::env::args().any(|argument| argument == "--dump-openapi") {
        if let Err(error) = export_openapi() {
            eprintln!("Failed to write openapi.json: {error}");
            std::process::exit(1);
        }
        return;
    }

    // Keep api/openapi.json current on every normal start.
    if let Err(error) = export_openapi() {
        tracing::warn!("Failed to write openapi.json: {error}");
    }

    let config = Config::from_env().unwrap_or_else(|error| {
        eprintln!("{error}. Copy api/.env.example to api/.env and set it.");
        std::process::exit(1);
    });

    let verifier = auth::TokenVerifier::new(&config.jwt);

    let state = state::AppState::new(config, verifier)
        .await
        .unwrap_or_else(|error| {
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

#[cfg(test)]
mod tests {
    use serde_json::{Value, json};

    use super::ApiDoc;

    use utoipa::OpenApi;

    const PROPERTY_OPERATIONS: [(&str, &str); 4] = [
        ("/properties", "get"),
        ("/properties", "post"),
        ("/properties", "delete"),
        ("/properties/{id}", "delete"),
    ];

    fn document() -> Value {
        serde_json::to_value(ApiDoc::openapi()).expect("the OpenAPI document should serialize")
    }

    fn operation<'a>(document: &'a Value, path: &str, method: &str) -> &'a Value {
        let operation = &document["paths"][path][method];

        assert!(
            operation.is_object(),
            "{method} {path} should be documented"
        );

        operation
    }

    #[test]
    fn the_document_declares_a_bearer_jwt_scheme() {
        let document = document();
        let scheme = &document["components"]["securitySchemes"]["bearer_auth"];

        assert_eq!(scheme["type"], "http");
        assert_eq!(scheme["scheme"], "bearer");
        assert_eq!(scheme["bearerFormat"], "JWT");
    }

    #[test]
    fn every_property_operation_requires_the_bearer_scheme() {
        let document = document();

        for (path, method) in PROPERTY_OPERATIONS {
            let security = &operation(&document, path, method)["security"];

            assert_eq!(
                security,
                &json!([{ "bearer_auth": [] }]),
                "{method} {path} should require the bearer scheme"
            );
        }
    }

    #[test]
    fn every_property_operation_documents_the_401_envelope() {
        let document = document();

        for (path, method) in PROPERTY_OPERATIONS {
            let response = &operation(&document, path, method)["responses"]["401"];

            assert_eq!(response["description"], "Unauthorized", "{method} {path}");
            assert_eq!(
                response["content"]["application/json"]["schema"]["$ref"],
                "#/components/schemas/ApiEnvelope_TupleUnit",
                "{method} {path}"
            );
        }
    }

    #[test]
    fn every_property_operation_documents_the_503_envelope() {
        let document = document();

        for (path, method) in PROPERTY_OPERATIONS {
            let response = &operation(&document, path, method)["responses"]["503"];

            assert_eq!(
                response["description"],
                "Authentication is temporarily unavailable. Try again shortly.",
                "{method} {path}"
            );
            assert_eq!(
                response["content"]["application/json"]["schema"]["$ref"],
                "#/components/schemas/ApiEnvelope_TupleUnit",
                "{method} {path}"
            );
        }
    }

    #[test]
    fn the_health_operation_requires_no_token() {
        let document = document();
        let health = operation(&document, "/health", "get");

        assert_eq!(
            health["security"],
            json!([]),
            "the global bearer requirement must not apply to /health"
        );
    }

    #[test]
    fn property_operations_keep_their_existing_responses() {
        const EXISTING: [(&str, &str, &[&str]); 4] = [
            ("/properties", "get", &["200", "500"]),
            ("/properties", "post", &["201", "400", "500"]),
            ("/properties", "delete", &["400"]),
            ("/properties/{id}", "delete", &["200", "400", "404", "500"]),
        ];

        let document = document();

        for (path, method, statuses) in EXISTING {
            for status in statuses {
                let response = &operation(&document, path, method)["responses"][status];

                assert!(
                    response.is_object(),
                    "{method} {path} should still document {status}"
                );
            }
        }
    }
}
