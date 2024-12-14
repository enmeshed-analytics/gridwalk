mod app_state;
mod auth;
mod core;
mod data;
mod routes;
mod server;

use crate::app_state::AppState;
use crate::core::{GeoConnections, PostgisConnector};
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

    // Create GeospatialConnections
    let geo_connections = GeoConnections::new();

    // Create initial App State
    let app_state = AppState {
        app_data: app_db,
        geo_connections,
    };

    // Check for primary connection info in app_data and add to geo_connections if found
    let geoconnection_record_primary = app_state.app_data.get_connection("primary").await;
    match geoconnection_record_primary {
        Ok(geoconnection_primary) => {
            info!("Primary connection found");
            let postgis_connector = PostgisConnector::new(geoconnection_primary.config).unwrap();
            app_state
                .geo_connections
                .add_connection("primary".to_string(), postgis_connector)
                .await;
        }
        Err(_) => info!("Primary connection not found. Skipping..."),
    }

    // Run app
    let app = server::create_app(app_state);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await?;
    info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}
