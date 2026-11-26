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

/// Supabase Auth material required to verify access tokens (ADR 0007).
#[derive(Clone, Debug)]
pub struct JwtConfig {
    /// Expected `iss`, e.g. `https://<ref>.supabase.co/auth/v1`.
    pub issuer: String,
    /// Location of the project key set, e.g. `.../auth/v1/.well-known/jwks.json`.
    pub jwks_url: String,
    /// Expected `aud`; `authenticated` for Supabase users.
    pub audience: String,
}

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub cors_origins: Vec<String>,
    pub jwt: JwtConfig,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_lookup(|key| env::var(key).ok())
    }

    /// Reads configuration through `lookup` so tests need not mutate the process
    /// environment. `from_env` is the only production caller.
    pub fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Result<Self, ConfigError> {
        let database_url = required(&lookup, "DATABASE_URL")?;

        let port = lookup("PORT")
            .filter(|port| !port.trim().is_empty())
            .unwrap_or_else(|| "3000".into())
            .parse()
            .map_err(|_| ConfigError::InvalidPort)?;

        let cors_origins = lookup("CORS_ORIGINS")
            .unwrap_or_else(|| DEFAULT_CORS_ORIGINS.join(","))
            .split(',')
            .map(str::trim)
            .filter(|origin| !origin.is_empty())
            .map(String::from)
            .collect();

        let jwt = JwtConfig {
            issuer: required(&lookup, "SUPABASE_JWT_ISSUER")?,
            jwks_url: required(&lookup, "SUPABASE_JWKS_URL")?,
            audience: required(&lookup, "SUPABASE_JWT_AUD")?,
        };

        Ok(Self {
            database_url,
            port,
            cors_origins,
            jwt,
        })
    }
}

fn required(
    lookup: &impl Fn(&str) -> Option<String>,
    key: &'static str,
) -> Result<String, ConfigError> {
    lookup(key)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or(ConfigError::Missing(key))
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("{0} must be set")]
    Missing(&'static str),

    #[error("PORT must be a number")]
    InvalidPort,
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::{Config, ConfigError};

    fn lookup(vars: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let vars: HashMap<String, String> = vars
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect();
        move |key| vars.get(key).cloned()
    }

    fn complete_env() -> Vec<(&'static str, &'static str)> {
        vec![
            ("DATABASE_URL", "postgresql://localhost/app"),
            ("SUPABASE_JWT_ISSUER", "https://ref.supabase.co/auth/v1"),
            (
                "SUPABASE_JWKS_URL",
                "https://ref.supabase.co/auth/v1/.well-known/jwks.json",
            ),
            ("SUPABASE_JWT_AUD", "authenticated"),
        ]
    }

    fn without(key: &str) -> Vec<(&'static str, &'static str)> {
        complete_env()
            .into_iter()
            .filter(|(name, _)| *name != key)
            .collect()
    }

    #[test]
    fn loads_the_auth_configuration() {
        let config = Config::from_lookup(lookup(&complete_env())).expect("config should load");

        assert_eq!(config.jwt.issuer, "https://ref.supabase.co/auth/v1");
        assert_eq!(
            config.jwt.jwks_url,
            "https://ref.supabase.co/auth/v1/.well-known/jwks.json"
        );
        assert_eq!(config.jwt.audience, "authenticated");
    }

    #[test]
    fn refuses_to_start_without_the_issuer() {
        let error = Config::from_lookup(lookup(&without("SUPABASE_JWT_ISSUER")))
            .expect_err("config without an issuer should be refused");

        assert!(matches!(error, ConfigError::Missing("SUPABASE_JWT_ISSUER")));
    }

    #[test]
    fn refuses_to_start_without_the_jwks_url() {
        let error = Config::from_lookup(lookup(&without("SUPABASE_JWKS_URL")))
            .expect_err("config without a JWKS URL should be refused");

        assert!(matches!(error, ConfigError::Missing("SUPABASE_JWKS_URL")));
    }

    #[test]
    fn refuses_to_start_without_the_audience() {
        let error = Config::from_lookup(lookup(&without("SUPABASE_JWT_AUD")))
            .expect_err("config without an audience should be refused");

        assert!(matches!(error, ConfigError::Missing("SUPABASE_JWT_AUD")));
    }

    #[test]
    fn refuses_to_start_with_a_blank_issuer() {
        let vars = complete_env()
            .into_iter()
            .map(|(key, value)| {
                if key == "SUPABASE_JWT_ISSUER" {
                    (key, "   ")
                } else {
                    (key, value)
                }
            })
            .collect::<Vec<_>>();

        let error = Config::from_lookup(lookup(&vars))
            .expect_err("config with a blank issuer should be refused");

        assert!(matches!(error, ConfigError::Missing("SUPABASE_JWT_ISSUER")));
    }
}
