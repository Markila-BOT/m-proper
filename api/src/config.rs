use std::env;

/// Origins allowed by the CORS layer when `CORS_ORIGINS` is not set.
/// Defaults to the allow-list previously hardcoded in `routes/mod.rs`.
const DEFAULT_CORS_ORIGINS: &[&str] = &[
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5173",
];

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub cors_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let database_url =
            env::var("DATABASE_URL").map_err(|_| ConfigError::Missing("DATABASE_URL"))?;

        let port = env::var("PORT")
            .unwrap_or_else(|_| "3000".into())
            .parse()
            .map_err(|_| ConfigError::InvalidPort)?;

        let cors_origins = env::var("CORS_ORIGINS")
            .unwrap_or_else(|_| DEFAULT_CORS_ORIGINS.join(","))
            .split(',')
            .map(str::trim)
            .filter(|origin| !origin.is_empty())
            .map(String::from)
            .collect();

        Ok(Self {
            database_url,
            port,
            cors_origins,
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("{0} must be set")]
    Missing(&'static str),

    #[error("PORT must be a number")]
    InvalidPort,
}
