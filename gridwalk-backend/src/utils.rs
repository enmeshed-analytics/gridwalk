use anyhow::{anyhow, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use sqlx::postgres::PgPoolOptions;
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

pub fn verify_password(stored_hash: &str, password_attempt: &str) -> Result<bool> {
    let parsed_hash = PasswordHash::new(stored_hash)
        .map_err(|e| anyhow!("Failed to parse stored password hash: {}", e))?;

    Ok(Argon2::default()
        .verify_password(password_attempt.as_bytes(), &parsed_hash)
        .is_ok())
}

pub async fn create_pg_pool(database_url: &str) -> Result<Arc<sqlx::Pool<sqlx::Postgres>>> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await
        .map_err(|e| anyhow!("Failed to create database pool: {}", e))?;
    Ok(Arc::new(pool))
}
