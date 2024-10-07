use anyhow::{anyhow, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use rand::{distributions::Alphanumeric, thread_rng, Rng};
use std::time::{SystemTime, UNIX_EPOCH};

pub async fn create_id(length: u64) -> String {
    let code: String = (0..length)
        .map(|_| thread_rng().sample(Alphanumeric) as char)
        .collect();
    code.to_uppercase()
}

pub fn get_unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs()
}

pub fn hash_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow!("Failed to hash password: {}", e))?
        .to_string();
    Ok(password_hash)
}
