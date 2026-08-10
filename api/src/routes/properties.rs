// api/src/routes/properties.rs
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get},
    Json, Router,
};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{
    ApiEnvelope, CreatePropertyRequest, Property, PropertyType,
};

#[derive(Clone)]
pub struct PropertiesState {
    pub pool: PgPool,
}

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .route("/", get(list_properties).post(create_property))
        .route("/{id}", delete(delete_property))
        .with_state(PropertiesState { pool })
}

#[derive(Debug, sqlx::FromRow)]
struct PropertyRow {
    id: Uuid,
    name: String,
    address: String,
    #[sqlx(rename = "type")]
    property_type: String,
    units: Option<i32>,
    is_active: bool,
    created_at: DateTime<Utc>,
}

impl PropertyRow {
    fn into_property(self) -> Result<Property, String> {
        let property_type = PropertyType::parse(&self.property_type)
            .ok_or_else(|| format!("Invalid property type in database: {}", self.property_type))?;

        Ok(Property {
            id: self.id,
            name: self.name,
            address: self.address,
            property_type,
            units: self.units,
            is_active: self.is_active,
            created_at: self.created_at,
        })
    }
}

/// List all properties (active first, then newest created_at).
#[utoipa::path(
    get,
    path = "/properties",
    responses(
        (status = 200, description = "Properties fetched successfully"),
        (status = 500, description = "Internal server error")
    ),
    tag = "properties"
)]
pub async fn list_properties(
    State(state): State<PropertiesState>,
) -> (StatusCode, Json<ApiEnvelope<Vec<Property>>>) {
    let result = sqlx::query_as::<_, PropertyRow>(
        r#"
        SELECT id, name, address, type, units, is_active, created_at
        FROM properties
        ORDER BY is_active DESC, created_at DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await;

    match result {
        Ok(rows) => {
            let mut properties = Vec::with_capacity(rows.len());
            for row in rows {
                match row.into_property() {
                    Ok(property) => properties.push(property),
                    Err(message) => {
                        tracing::error!("{message}");
                        return (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(ApiEnvelope {
                                success: false,
                                message: "Internal server error".into(),
                                data: None,
                            }),
                        );
                    }
                }
            }

            (
                StatusCode::OK,
                Json(ApiEnvelope::ok(
                    "Properties fetched successfully",
                    properties,
                )),
            )
        }
        Err(error) => {
            tracing::error!("Failed to fetch properties: {error}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiEnvelope {
                    success: false,
                    message: format!("Failed to fetch properties: {error}"),
                    data: None,
                }),
            )
        }
    }
}

/// Create a new property.
#[utoipa::path(
    post,
    path = "/properties",
    request_body = CreatePropertyRequest,
    responses(
        (status = 201, description = "Property created successfully"),
        (status = 400, description = "Validation error"),
        (status = 500, description = "Internal server error")
    ),
    tag = "properties"
)]
pub async fn create_property(
    State(state): State<PropertiesState>,
    Json(body): Json<CreatePropertyRequest>,
) -> (StatusCode, Json<ApiEnvelope<Property>>) {
    let name = body.name.trim();
    let address = body.address.trim();

    if name.is_empty() || address.is_empty() || body.property_type.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiEnvelope {
                success: false,
                message: "Missing required fields: name, address, and type are required".into(),
                data: None,
            }),
        );
    }

    let Some(property_type) = PropertyType::parse(body.property_type.trim()) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiEnvelope {
                success: false,
                message: "Invalid property type. Must be one of: \"residential\", \"commercial\", \"lot\"".into(),
                data: None,
            }),
        );
    };

    let is_active = body.is_active.unwrap_or(true);
    let units = body.units;

    let result = sqlx::query_as::<_, PropertyRow>(
        r#"
        INSERT INTO properties (name, address, type, units, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, address, type, units, is_active, created_at
        "#,
    )
    .bind(name)
    .bind(address)
    .bind(property_type.as_str())
    .bind(units)
    .bind(is_active)
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(row) => match row.into_property() {
            Ok(property) => (
                StatusCode::CREATED,
                Json(ApiEnvelope::ok("Property created successfully", property)),
            ),
            Err(message) => {
                tracing::error!("{message}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ApiEnvelope {
                        success: false,
                        message: "Internal server error".into(),
                        data: None,
                    }),
                )
            }
        },
        Err(error) => {
            tracing::error!("Failed to create property: {error}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiEnvelope {
                    success: false,
                    message: format!("Failed to create property: {error}"),
                    data: None,
                }),
            )
        }
    }
}

/// Delete a property by id.
#[utoipa::path(
    delete,
    path = "/properties/{id}",
    params(
        ("id" = Uuid, Path, description = "Property id")
    ),
    responses(
        (status = 200, description = "Property deleted successfully"),
        (status = 400, description = "Missing or invalid id"),
        (status = 500, description = "Internal server error")
    ),
    tag = "properties"
)]
pub async fn delete_property(
    State(state): State<PropertiesState>,
    Path(id): Path<String>,
) -> (StatusCode, Json<ApiEnvelope<()>>) {
    let id = id.trim();
    if id.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiEnvelope::err("Property ID is required")),
        );
    }

    let Ok(uuid) = Uuid::parse_str(id) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiEnvelope::err("Property ID is required")),
        );
    };

    let result = sqlx::query("DELETE FROM properties WHERE id = $1")
        .bind(uuid)
        .execute(&state.pool)
        .await;

    match result {
        Ok(_) => (
            StatusCode::OK,
            Json(ApiEnvelope::ok_message("Property deleted successfully")),
        ),
        Err(error) => {
            tracing::error!("Failed to delete property: {error}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiEnvelope::err(format!(
                    "Failed to delete property: {error}"
                ))),
            )
        }
    }
}
