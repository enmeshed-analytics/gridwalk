use dotenvy::dotenv;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::env;
use std::num::ParseIntError;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::Mutex;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub max_connections: u32,
    pub base_url: String,
    pub smtp_host: String,
    pub smtp_username: String,
    pub smtp_password: String,
    pub from_email: String,
    pub email_templates_dir: String,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Missing environment variable: {0}")]
    MissingVar(String),
    #[error("Invalid value for {0}: {1}")]
    InvalidValue(String, String),
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        // Load .env file if it exists
        dotenv().ok();

        // Construct database URL from individual components
        let user = env::var("DATABASE_USER")
            .map_err(|_| ConfigError::MissingVar("DATABASE_USER".to_string()))?;
        let password = env::var("DATABASE_PASSWORD")
            .map_err(|_| ConfigError::MissingVar("DATABASE_PASSWORD".to_string()))?;
        let host = env::var("DATABASE_HOST")
            .map_err(|_| ConfigError::MissingVar("DATABASE_HOST".to_string()))?;
        let database_name = env::var("DATABASE_NAME")
            .map_err(|_| ConfigError::MissingVar("DATABASE_NAME".to_string()))?;
        let port = env::var("DATABASE_PORT").unwrap_or_else(|_| "5432".to_string());

        let database_url = format!(
            "postgresql://{}:{}@{}:{}/{}",
            user, password, host, port, database_name
        );

        let max_connections = env::var("PG_MAX_CONNECTIONS")
            .unwrap_or_else(|_| "20".to_string())
            .parse::<u32>()
            .map_err(|e: ParseIntError| {
                ConfigError::InvalidValue("PG_MAX_CONNECTIONS".to_string(), e.to_string())
            })?;

        // Base URL configuration
        let base_url =
            env::var("BASE_URL").map_err(|_| ConfigError::MissingVar("BASE_URL".to_string()))?;

        // Email configuration
        let smtp_host =
            env::var("SMTP_HOST").map_err(|_| ConfigError::MissingVar("SMTP_HOST".to_string()))?;
        let smtp_username = env::var("SMTP_USERNAME")
            .map_err(|_| ConfigError::MissingVar("SMTP_USERNAME".to_string()))?;
        let smtp_password = env::var("SMTP_PASSWORD")
            .map_err(|_| ConfigError::MissingVar("SMTP_PASSWORD".to_string()))?;
        let from_email = env::var("FROM_EMAIL")
            .map_err(|_| ConfigError::MissingVar("FROM_EMAIL".to_string()))?;
        let email_templates_dir =
            env::var("EMAIL_TEMPLATES_DIR").unwrap_or_else(|_| "./email_templates".to_string());

        Ok(Config {
            database_url,
            max_connections,
            base_url,
            smtp_host,
            smtp_username,
            smtp_password,
            from_email,
            email_templates_dir,
        })
    }
}

#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<PgPool>,
    pub connections: crate::ActiveConnections,
    pub email_service: Arc<Mutex<crate::EmailService>>,
}

// Create the connection pool with configuration
// Requires the AGE extension to be installed in the database
pub async fn init_pool(config: &Config) -> Arc<PgPool> {
    Arc::new(
        PgPoolOptions::new()
            .max_connections(config.max_connections)
            .connect(&config.database_url)
            .await
            .expect("Failed to create pool"),
    )
}
