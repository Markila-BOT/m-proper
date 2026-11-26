// api/src/routes/properties.rs
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get},
};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::auth::Identity;
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

/// The owner predicate is the primary control (ADR 0008): the API connects as
/// the database owner, which bypasses RLS, so every statement scopes itself.
const LIST_OWNED_PROPERTIES_SQL: &str = r#"
    SELECT id, name, address, type, units, is_active, created_at
    FROM properties
    WHERE owner_id = $1
    ORDER BY is_active DESC, created_at DESC
"#;

/// `owner_id` comes from the verified subject, never from the request body, and
/// is bound last so the column list and the binds stay in step.
const INSERT_OWNED_PROPERTY_SQL: &str = r#"
    INSERT INTO properties (name, address, type, units, is_active, owner_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, name, address, type, units, is_active, created_at
"#;

/// Matching `id` and owner together is what makes a foreign row answer 404
/// exactly like an unknown id: it affects zero rows either way, so existence
/// never leaks.
const DELETE_OWNED_PROPERTY_SQL: &str = "DELETE FROM properties WHERE id = $1 AND owner_id = $2";

/// The one place a delete's row count becomes a result. Zero matched rows is a
/// 404, whether the row belongs to another landlord or does not exist at all;
/// keeping the mapping here lets it be tested without a database.
fn deleted_or_not_found(rows_affected: u64, id: Uuid) -> Result<(), AppError> {
    if rows_affected == 0 {
        return Err(AppError::NotFound(format!("Property {id} not found")));
    }

    Ok(())
}

/// A validated create, with its owner already derived from the token.
struct NewProperty {
    name: String,
    address: String,
    property_type: PropertyType,
    units: Option<i32>,
    is_active: bool,
    owner_id: Uuid,
}

impl NewProperty {
    /// `CreatePropertyRequest` has no owner field, so any owner the client sends
    /// is dropped by serde before validation runs. The only owner written is the
    /// verified subject's.
    fn from_request(body: CreatePropertyRequest, identity: Identity) -> Result<Self, AppError> {
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

        Ok(Self {
            name: name.to_string(),
            address: address.to_string(),
            property_type,
            units: body.units,
            is_active: body.is_active.unwrap_or(true),
            owner_id: identity.user_id,
        })
    }
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

/// List the signed-in owner's properties (active first, then newest created_at).
#[utoipa::path(
    get,
    path = "/properties",
    responses(
        (status = 200, description = "Properties fetched successfully", body = ApiEnvelope<Vec<Property>>),
        (status = 401, description = "Unauthorized", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 500, description = "Internal server error", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 503, description = "Authentication is temporarily unavailable. Try again shortly.", body = ApiEnvelope<utoipa::TupleUnit>)
    ),
    security(("bearer_auth" = [])),
    tag = "properties"
)]
pub async fn list_properties(
    State(state): State<AppState>,
    identity: Identity,
) -> Result<Json<ApiEnvelope<Vec<Property>>>, AppError> {
    let rows = sqlx::query_as::<_, PropertyRow>(LIST_OWNED_PROPERTIES_SQL)
        .bind(identity.user_id)
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

/// Create a new property owned by the signed-in account.
#[utoipa::path(
    post,
    path = "/properties",
    request_body = CreatePropertyRequest,
    responses(
        (status = 201, description = "Property created successfully", body = ApiEnvelope<Property>),
        (status = 400, description = "Validation error", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 401, description = "Unauthorized", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 500, description = "Internal server error", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 503, description = "Authentication is temporarily unavailable. Try again shortly.", body = ApiEnvelope<utoipa::TupleUnit>)
    ),
    security(("bearer_auth" = [])),
    tag = "properties"
)]
pub async fn create_property(
    State(state): State<AppState>,
    identity: Identity,
    Json(body): Json<CreatePropertyRequest>,
) -> Result<(StatusCode, Json<ApiEnvelope<Property>>), AppError> {
    let new = NewProperty::from_request(body, identity)?;

    let row = sqlx::query_as::<_, PropertyRow>(INSERT_OWNED_PROPERTY_SQL)
        .bind(new.name.as_str())
        .bind(new.address.as_str())
        .bind(new.property_type.as_str())
        .bind(new.units)
        .bind(new.is_active)
        .bind(new.owner_id)
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

/// Delete one of the signed-in owner's properties by id.
#[utoipa::path(
    delete,
    path = "/properties/{id}",
    params(
        ("id" = Uuid, Path, description = "Property id")
    ),
    responses(
        (status = 200, description = "Property deleted successfully", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 400, description = "Missing or invalid id", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 401, description = "Unauthorized", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 404, description = "Property not found", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 500, description = "Internal server error", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 503, description = "Authentication is temporarily unavailable. Try again shortly.", body = ApiEnvelope<utoipa::TupleUnit>)
    ),
    security(("bearer_auth" = [])),
    tag = "properties"
)]
pub async fn delete_property(
    State(state): State<AppState>,
    identity: Identity,
    Path(id): Path<String>,
) -> Result<(StatusCode, Json<ApiEnvelope<()>>), AppError> {
    let id = id.trim();
    if id.is_empty() {
        return Err(AppError::BadRequest("Property ID is required".into()));
    }

    let Ok(uuid) = Uuid::parse_str(id) else {
        return Err(AppError::BadRequest("Property ID is required".into()));
    };

    // Owner-scoped: a row belonging to another landlord matches no row, so it
    // takes the 404 path below exactly like an unknown id and existence does not
    // leak. The missing/invalid-id 400 path is handled above, before the query.
    let rows_affected = sqlx::query(DELETE_OWNED_PROPERTY_SQL)
        .bind(uuid)
        .bind(identity.user_id)
        .execute(&state.pool)
        .await?
        .rows_affected();

    deleted_or_not_found(rows_affected, uuid)?;

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
        (status = 400, description = "Missing property id", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 401, description = "Unauthorized", body = ApiEnvelope<utoipa::TupleUnit>),
        (status = 503, description = "Authentication is temporarily unavailable. Try again shortly.", body = ApiEnvelope<utoipa::TupleUnit>)
    ),
    security(("bearer_auth" = [])),
    tag = "properties"
)]
pub async fn delete_property_without_id(
    _identity: Identity,
) -> (StatusCode, Json<ApiEnvelope<()>>) {
    (
        StatusCode::BAD_REQUEST,
        Json(ApiEnvelope::err("Property ID is required")),
    )
}

#[cfg(test)]
mod tests {
    use axum::{
        body::{Body, to_bytes},
        http::{Method, Request, StatusCode},
    };
    use serde_json::Value;
    use sqlx::postgres::PgPoolOptions;
    use tower::ServiceExt;

    use uuid::Uuid;

    use crate::{
        auth::{Identity, TokenVerifier, test_support},
        config::Config,
        models::{CreatePropertyRequest, Property, PropertyType},
        state::AppState,
    };
    use axum::response::IntoResponse;

    use super::{
        DELETE_OWNED_PROPERTY_SQL, INSERT_OWNED_PROPERTY_SQL, LIST_OWNED_PROPERTIES_SQL,
        NewProperty, router,
    };

    /// Statement text with runs of whitespace collapsed, so assertions read as
    /// SQL rather than as source indentation.
    fn one_line(sql: &str) -> String {
        sql.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    fn owner() -> Identity {
        Identity {
            user_id: Uuid::parse_str("0f8fad5b-d9cb-469f-a165-70867728950e")
                .expect("the owner id should parse"),
        }
    }

    fn another_owner() -> Uuid {
        Uuid::parse_str("3b7d4f7c-5a1e-4d76-9a1f-2c9b8e6a4d10")
            .expect("the other owner id should parse")
    }

    /// A state whose pool is created lazily: nothing connects until a query
    /// runs, and the auth tests never reach one.
    fn test_state(verifier: TokenVerifier) -> AppState {
        const UNUSED_URL: &str = "postgresql://localhost/unused";

        AppState {
            pool: PgPoolOptions::new()
                .connect_lazy(UNUSED_URL)
                .expect("the unused URL should parse"),
            config: Config {
                database_url: UNUSED_URL.into(),
                port: 0,
                cors_origins: Vec::new(),
                jwt: test_support::jwt_config(),
            },
            verifier,
        }
    }

    async fn send_with(
        state: AppState,
        method: Method,
        uri: &str,
        authorization: Option<&str>,
    ) -> axum::response::Response {
        let app = router().with_state(state);

        let mut request = Request::builder().method(method).uri(uri);
        if let Some(value) = authorization {
            request = request.header("authorization", value);
        }

        app.oneshot(
            request
                .body(Body::empty())
                .expect("the test request should build"),
        )
        .await
        .expect("the router should answer")
    }

    async fn send(
        method: Method,
        uri: &str,
        authorization: Option<&str>,
    ) -> axum::response::Response {
        send_with(
            test_state(test_support::verifier()),
            method,
            uri,
            authorization,
        )
        .await
    }

    async fn body_json(response: axum::response::Response) -> Value {
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("the response body should read");
        serde_json::from_slice(&bytes).expect("the response body should be the JSON envelope")
    }

    async fn assert_unauthorized(response: axum::response::Response) {
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        let body = body_json(response).await;
        assert_eq!(body["success"], false);
        assert_eq!(body["message"], "Unauthorized");
        assert!(
            body.get("data").is_none(),
            "a refusal must not carry data: {body}"
        );
    }

    fn valid_bearer() -> String {
        format!(
            "Bearer {}",
            test_support::token(&test_support::valid_claims())
        )
    }

    #[tokio::test]
    async fn a_request_without_an_authorization_header_is_401() {
        assert_unauthorized(send(Method::GET, "/", None).await).await;
    }

    #[tokio::test]
    async fn a_bearer_header_without_a_token_is_401() {
        assert_unauthorized(send(Method::GET, "/", Some("Bearer")).await).await;
    }

    #[tokio::test]
    async fn a_non_bearer_scheme_is_401() {
        assert_unauthorized(send(Method::GET, "/", Some("Basic dXNlcjpwYXNz")).await).await;
    }

    #[tokio::test]
    async fn a_garbage_token_is_401() {
        assert_unauthorized(send(Method::GET, "/", Some("Bearer not-a-jwt")).await).await;
    }

    #[tokio::test]
    async fn a_bearer_token_with_trailing_junk_is_refused() {
        let header = format!("{} extra", valid_bearer());

        assert_unauthorized(send(Method::GET, "/", Some(&header)).await).await;
    }

    #[tokio::test]
    async fn the_bearer_scheme_is_case_insensitive() {
        let header = valid_bearer().replacen("Bearer", "bearer", 1);

        let response = send(Method::DELETE, "/not-a-uuid", Some(&header)).await;

        assert_eq!(
            response.status(),
            StatusCode::BAD_REQUEST,
            "the handler should be reached with a lowercase scheme"
        );
    }

    #[tokio::test]
    async fn whitespace_around_the_authorization_value_is_ignored() {
        let header = format!("  {}  ", valid_bearer().replace(' ', "   "));

        let response = send(Method::DELETE, "/not-a-uuid", Some(&header)).await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn a_valid_token_reaches_the_handler() {
        let response = send(Method::DELETE, "/not-a-uuid", Some(&valid_bearer())).await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = body_json(response).await;
        assert_eq!(body["success"], false);
        assert_eq!(body["message"], "Property ID is required");
    }

    #[tokio::test]
    async fn a_signed_in_delete_without_an_id_keeps_the_400_envelope() {
        let response = send(Method::DELETE, "/", Some(&valid_bearer())).await;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = body_json(response).await;
        assert_eq!(body["success"], false);
        assert_eq!(body["message"], "Property ID is required");
    }

    #[tokio::test]
    async fn an_unavailable_key_set_is_503() {
        let verifier = TokenVerifier::with_fetcher(
            &test_support::jwt_config(),
            test_support::failing_fetcher(),
        );

        let response = send_with(
            test_state(verifier),
            Method::GET,
            "/",
            Some(&valid_bearer()),
        )
        .await;

        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = body_json(response).await;
        assert_eq!(body["success"], false);
        assert_eq!(
            body["message"],
            "Authentication is temporarily unavailable. Try again shortly."
        );
    }

    #[tokio::test]
    async fn a_body_owner_field_is_ignored() {
        // A client may send any owner shape it likes; none of it reaches the row.
        let body: CreatePropertyRequest = serde_json::from_value(serde_json::json!({
            "name": "Riverside Duplex",
            "address": "12 River Road",
            "type": "residential",
            "units": 2,
            "ownerId": another_owner(),
            "owner_id": another_owner(),
            "owner": another_owner(),
        }))
        .expect("the body should deserialise without an owner field");

        let new = NewProperty::from_request(body, owner()).expect("the body should validate");

        assert_eq!(new.owner_id, owner().user_id);
        assert_ne!(new.owner_id, another_owner());
    }

    #[test]
    fn the_list_query_filters_by_the_owner() {
        let sql = one_line(LIST_OWNED_PROPERTIES_SQL);

        assert!(
            sql.ends_with("WHERE owner_id = $1 ORDER BY is_active DESC, created_at DESC"),
            "the list must filter on the owner before ordering: {sql}"
        );
        assert_eq!(
            LIST_OWNED_PROPERTIES_SQL.matches('$').count(),
            1,
            "the list binds exactly the owner: {sql}"
        );
    }

    #[test]
    fn the_insert_writes_the_owner_as_its_last_bind() {
        let sql = one_line(INSERT_OWNED_PROPERTY_SQL);

        assert!(
            sql.contains(
                "INSERT INTO properties (name, address, type, units, is_active, owner_id) VALUES ($1, $2, $3, $4, $5, $6)"
            ),
            "the owner is written last, in step with the binds: {sql}"
        );
    }

    #[test]
    fn the_delete_query_matches_the_id_and_the_owner() {
        let sql = one_line(DELETE_OWNED_PROPERTY_SQL);

        // A foreign row matches no row, exactly like an unknown id: both 404.
        assert_eq!(
            sql, "DELETE FROM properties WHERE id = $1 AND owner_id = $2",
            "the delete must carry both predicates: {sql}"
        );
    }

    #[tokio::test]
    async fn a_delete_that_matched_no_row_is_404() {
        // A foreign row and an unknown id both match zero rows, so both must
        // answer the same 404 and never reveal that the row exists.
        let id = Uuid::parse_str("9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f")
            .expect("the property id should parse");

        let error = super::deleted_or_not_found(0, id)
            .expect_err("zero matched rows must not count as a deletion");

        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = body_json(response).await;
        assert_eq!(body["success"], false);
        assert_eq!(body["message"], format!("Property {id} not found"));
    }

    #[test]
    fn a_delete_that_matched_a_row_succeeds() {
        assert!(
            super::deleted_or_not_found(1, Uuid::nil()).is_ok(),
            "a matched row is a successful delete, not a 404"
        );
    }

    #[test]
    fn a_serialised_property_does_not_carry_an_owner() {
        let property = Property {
            id: Uuid::nil(),
            name: "Riverside Duplex".into(),
            address: "12 River Road".into(),
            property_type: PropertyType::Residential,
            units: Some(2),
            is_active: true,
            created_at: chrono::Utc::now(),
        };

        let wire = serde_json::to_value(&property).expect("the property should serialise");

        assert!(wire.get("ownerId").is_none(), "no camelCase owner: {wire}");
        assert!(
            wire.get("owner_id").is_none(),
            "no snake_case owner: {wire}"
        );
    }
}
