use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub port: u16,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let database_url =
            env::var("DATABASE_URL").map_err(|_| ConfigError::Missing("DATABASE_URL"))?;

        let port = env::var("PORT")
            .unwrap_or_else(|_| "3000".into())
            .parse()
            .map_err(|_| ConfigError::InvalidPort)?;

        Ok(Self { database_url, port })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("{0} must be set")]
    Missing(&'static str),

    #[error("PORT must be a number")]
    InvalidPort,
}
