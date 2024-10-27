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
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Create DynamoDB client
    let app_db = Dynamodb::new(true, "gridwalk").await.unwrap();

    // Create GeospatialConfig
    let geospatial_config = GeospatialConfig::new();

    // Create initial App State
    let app_state = AppState {
        app_data: app_db,
        geospatial_config,
    };

    // Run app
    let app = server::create_app(app_state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001").await?;
    info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}
