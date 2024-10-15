mod app_state;
mod auth;
mod core;
mod data;
mod routes;
mod server;

use crate::app_state::AppState;
use crate::core::{GeospatialConfig, PostgisConfig};
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

    let app_state = AppState {
        app_data: app_db,
        geospatial_config,
    };

    // Geospatial data source test code
    let postgis_uri = PostgisConfig::new_from_uri(
        "postgresql://admin:password@localhost:5432/gridwalk".to_string(),
    )?;

    app_state
        .geospatial_config
        .add_connection("primary_postgis".to_string(), postgis_uri)
        .await;

    let mut con = app_state
        .geospatial_config
        .get_connection("primary_postgis")
        .await
        .unwrap();

    con.connect().await.unwrap();
    con.list_sources().await.unwrap();

    // Run app
    let app = server::create_app(app_state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001").await?;
    info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}
