mod auth;
mod connector;
mod data;
mod error;
mod layer;
mod project;
mod server;
mod session;
mod user;
mod utils;
mod workspace;

use crate::connector::*;
use crate::layer::*;
use crate::project::*;
use crate::session::*;
use crate::user::*;
use crate::utils::create_pg_pool;
use crate::workspace::*;
use sqlx::postgres::PgPool;
use std::sync::Arc;

use anyhow::Result;
use dotenvy::dotenv;
use tracing::info;

#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<PgPool>,
    pub connections: ActiveConnections,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialise tracing
    tracing_subscriber::fmt().with_ansi(false).init();
    // Load environment variables from .env file
    dotenv().ok();

    let app_db = create_pg_pool("postgres://admin:password@localhost:5433/gridwalk")
        .await
        .unwrap();

    // Create GeospatialConnections
    let active_connections = ActiveConnections::new();

    // Create initial App State
    let app_state = AppState {
        pool: app_db,
        connections: active_connections,
    };

    // Run app
    let app = server::create_app(app_state);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await?;
    info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}
