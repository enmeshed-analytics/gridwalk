use anyhow::{anyhow, Result};
use martin::pg::PgConfig;
use martin::{IdResolver, OptBoolObj, Source};

pub async fn initialize_pg_config() -> Result<Vec<Box<dyn Source>>> {
    let mut pg_config = PgConfig {
        connection_string: Some("postgresql://admin:password@localhost:5432/gridwalk".to_string()),
        auto_publish: OptBoolObj::Bool(true),
        ..Default::default()
    };
    pg_config
        .finalize()
        .map_err(|e| anyhow!("Failed to finalize PgConfig: {}", e))?;
    pg_config
        .resolve(IdResolver::default())
        .await
        .map_err(|e| anyhow!("Failed to resolve PgConfig: {}", e))
}

