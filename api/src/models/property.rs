use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApiEnvelope<T: Serialize> {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

impl<T: Serialize> ApiEnvelope<T> {
    pub fn ok(message: impl Into<String>, data: T) -> Self {
        Self {
            success: true,
            message: message.into(),
            data: Some(data),
        }
    }
}

impl ApiEnvelope<()> {
    pub fn ok_message(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: message.into(),
            data: None,
        }
    }

    pub fn err(message: impl Into<String>) -> Self {
        Self {
            success: false,
            message: message.into(),
            data: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PropertyType {
    Residential,
    Commercial,
    Lot,
}

impl PropertyType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Residential => "residential",
            Self::Commercial => "commercial",
            Self::Lot => "lot",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "residential" => Some(Self::Residential),
            "commercial" => Some(Self::Commercial),
            "lot" => Some(Self::Lot),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Property {
    pub id: Uuid,
    pub name: String,
    pub address: String,
    #[serde(rename = "type")]
    pub property_type: PropertyType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub units: Option<i32>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreatePropertyRequest {
    pub name: String,
    pub address: String,
    #[serde(rename = "type")]
    pub property_type: String,
    pub units: Option<i32>,
    pub is_active: Option<bool>,
}
