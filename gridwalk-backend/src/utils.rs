use anyhow::{anyhow, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use sqlx::postgres::{PgPool, PgPoolOptions};
use sqlx::Executor;
use std::sync::Arc;

pub fn hash_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow!("Failed to hash password: {}", e))?
        .to_string();
    Ok(password_hash)
}

pub async fn create_pg_pool(database_url: &str) -> Result<Arc<sqlx::Pool<sqlx::Postgres>>> {
    let temp_pool = PgPool::connect(database_url).await?;
    sqlx::query("CREATE SCHEMA IF NOT EXISTS gridwalk")
        .execute(&temp_pool)
        .await?;
    temp_pool.close().await;
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                conn.execute("SET search_path = gridwalk, \"$user\", public")
                    .await?;
                Ok(())
            })
        })
        .connect(database_url)
        .await
        .map_err(|e| anyhow!("Failed to create database pool: {}", e))?;
    Ok(Arc::new(pool))
}
