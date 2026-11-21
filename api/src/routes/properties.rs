// api/src/routes/properties.rs
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get},
};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::{ApiEnvelope, CreatePropertyRequest, Property, PropertyType};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            get(list_properties)
                .post(create_property)
                .delete(delete_property_without_id),
        )
        .route("/{id}", delete(delete_property))
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
    fn into_property(self) -> Result<Property, AppError> {
        let property_type = PropertyType::parse(&self.property_type).ok_or_else(|| {
            AppError::Internal(format!(
                "Invalid property type in database: {}",
                self.property_type
            ))
        })?;

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
        (status = 200, description = "Properties fetched successfully", body = ApiEnvelope<Vec<Property>>),
        (status = 500, description = "Internal server error", body = ApiEnvelope<utoipa::TupleUnit>)
    ),
    tag = "properties"
)]
pub async fn list_properties(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<Property>>>, AppError> {
    let rows = sqlx::query_as::<_, PropertyRow>(
        r#"
        SELECT id, name, address, type, units, is_active, created_at
        FROM properties
        ORDER BY is_active DESC, created_at DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await?;

    let properties = rows
        .into_iter()
        .map(PropertyRow::into_property)
        .collect::<Result<Vec<_>, _>>()?;

    Ok(Json(ApiEnvelope::ok(
        "Properties fetched successfully",
        properties,
    )))
}

/// Create a new property.
#[utoipa::path(
    post,
    path = "/properties",
    request_body = CreatePropertyRequest,
    responses(
        (status = 201, description = "Property created successfully", body = ApiEnvelope<Property>),
        (status = 400, description = "Validation error", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 500, description = "Internal server error", body = ApiEnvelope<utoipa::TupleUnit>)
    ),
    tag = "properties"
)]
pub async fn create_property(
    State(state): State<AppState>,
    Json(body): Json<CreatePropertyRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<Property>>), AppError> {
    let name = body.name.trim();
    let address = body.address.trim();

    if name.is_empty() || address.is_empty() || body.property_type.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Missing required fields: name, address, and type are required".into(),
        ));
    }

    let Some(property_type) = PropertyType::parse(body.property_type.trim()) else {
        return Err(AppError::BadRequest(
            "Invalid property type. Must be one of: \"residential\", \"commercial\", \"lot\""
                .into(),
        ));
    };

    if body.units.is_some_and(|units| units < 0) {
        return Err(AppError::BadRequest(
            "Invalid units. Units must be zero or greater".into(),
        ));
    }

    let is_active = body.is_active.unwrap_or(true);
    let units = body.units;

    let row = sqlx::query_as::<_, PropertyRow>(
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
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(ApiEnvelope::ok(
            "Property created successfully",
            row.into_property()?,
        )),
    ))
}

/// Delete a property by id.
#[utoipa::path(
    delete,
    path = "/properties/{id}",
    params(
        ("id" = Uuid, Path, description = "Property id")
    ),
    responses(
        (status = 200, description = "Property deleted successfully", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 400, description = "Missing or invalid id", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 404, description = "Property not found", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 500, description = "Internal server error", body = ApiEnvelope<utoipa::TupleUnit>)
    ),
    tag = "properties"
)]
pub async fn delete_property(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<(StatusCode, Json<ApiEnvelope<()>>), AppError> {
    let id = id.trim();
    if id.is_empty() {
        return Err(AppError::BadRequest("Property ID is required".into()));
    }

    let Ok(uuid) = Uuid::parse_str(id) else {
        return Err(AppError::BadRequest("Property ID is required".into()));
    };

    let rows_affected = sqlx::query("DELETE FROM properties WHERE id = $1")
        .bind(uuid)
        .execute(&state.pool)
        .await?
        .rows_affected();

    if rows_affected == 0 {
        return Err(AppError::NotFound(format!("Property {uuid} not found")));
    }

    Ok((
        StatusCode::OK,
        Json(ApiEnvelope::ok_message("Property deleted successfully")),
    ))
}

/// Delete without a property id: answer the spec's 400 envelope.
#[utoipa::path(
    delete,
    path = "/properties",
    responses(
        (status = 400, description = "Missing property id", body = ApiEnvelope<utoipa::TupleUnit>)
    ),
    tag = "properties"
)]
pub async fn delete_property_without_id() -> (StatusCode, Json<ApiEnvelope<()>>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ApiEnvelope::err("Property ID is required")),
    )
}
