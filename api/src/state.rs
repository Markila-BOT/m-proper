use sqlx::PgPool;

use crate::{auth::TokenVerifier, config::Config, db};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
    pub verifier: TokenVerifier,
}

impl AppState {
    pub async fn new(config: Config, verifier: TokenVerifier) -> Result<Self, sqlx::Error> {
        let pool = db::connect(&config.database_url).await?;

        Ok(Self {
            pool,
            config,
            verifier,
        })
    }
}
