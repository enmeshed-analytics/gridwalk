mod app_state;
mod auth;
mod core;
mod data;
mod routes;
mod server;

use crate::app_state::AppState;
use crate::core::GeospatialConfig;
use crate::data::Dynamodb;

use anyhow::Result;
use std::env;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialise tracing
    tracing_subscriber::fmt::init();

    // Create DynamoDB client
    let table_name = env::var("DYNAMODB_TABLE").unwrap_or_else(|_| "gridwalk".to_string());
    // let app_db = Dynamodb::new(false, &table_name).await.unwrap();
    // FOR LOCAL DB DEV
    let app_db = Dynamodb::new(true, &table_name).await.unwrap();

    // Create GeospatialConfig
    let geospatial_config = GeospatialConfig::new();

    // Create initial App State
    let app_state = AppState {
        app_data: app_db,
        geospatial_config,
    };

    // Run app
    let app = server::create_app(app_state);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await?;
    info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}
