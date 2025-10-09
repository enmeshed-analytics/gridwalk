mod auth;
mod config;
mod connector;
mod datastore;
mod email;
mod error;
mod layer;
mod map;
mod server;
mod session;
mod settings;
mod user;
mod utils;
mod workspace;

use crate::config::*;
use crate::datastore::*;
use crate::email::*;
use crate::layer::*;
use crate::map::*;
use crate::session::*;
use crate::settings::*;
use crate::user::*;
use crate::workspace::*;
use std::env;
use std::sync::Arc;

use anyhow::Result;
use dotenvy::dotenv;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialise tracing
    tracing_subscriber::fmt().with_ansi(false).init();
    // Load environment variables from .env file
    dotenv().ok();

    // Initialize configuration
    let config = Config::from_env().expect("Failed to load configuration from environment");

    let app_db = init_pool(&config).await;

    sqlx::migrate!("./migrations")
        .run(app_db.as_ref())
        .await
        .expect("Failed to run migrations");

    // Create GeospatialConnections
    let active_connections = ActiveConnections::new();

    // Initialize EmailService
    let email_service = EmailService::new(
        &config.smtp_host,
        &config.smtp_username,
        &config.smtp_password,
        &config.from_email,
        &config.email_templates_dir,
        &config.base_url,
    )
    .expect("Failed to initialize email service");

    // Create initial App State
    let app_state = AppState {
        pool: app_db,
        connections: active_connections,
        email_service: Arc::new(tokio::sync::Mutex::new(email_service)),
    };

    // Create initial user
    let initial_user_email = env::var("GW_INITIAL_USER_EMAIL").unwrap();
    let initial_user_password = env::var("GW_INITIAL_USER_PASSWORD").unwrap();
    println!("Initial user email set: {}", initial_user_email);
    let existing_user = User::from_email(&*app_state.pool, &initial_user_email).await;
    match existing_user {
        Ok(user) => {
            info!("Initial user already exists: {:?}", user);
        }
        Err(_) => {
            let initial_user = User::new(
                initial_user_email.clone(),
                Some("admin".to_string()),
                Some("admin".to_string()),
                Some(GlobalRole::Admin),
                UserStatus::Active,
                None,
            );
            let mut tx = app_state.pool.begin().await?;
            initial_user.save(&mut *tx).await?;
            let initial_password = UserPassword::new(initial_user.id, initial_user_password);
            initial_password.save(&mut *tx).await?;
            tx.commit().await?;
            info!("Created initial user with email: {}", initial_user_email);
        }
    }

    // Run app
    let app = server::create_app(app_state);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await?;
    info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}
