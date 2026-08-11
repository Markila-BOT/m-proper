use sqlx::PgPool;

use crate::{config::Config, db};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, sqlx::Error> {
        let pool = db::connect(&config.database_url).await?;

        Ok(Self { pool, config })
    }
}
