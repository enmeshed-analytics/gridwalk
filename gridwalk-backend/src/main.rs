mod app_state;
mod auth;
mod connector;
mod data;
mod layer;
mod project;
mod server;
mod session;
mod user;
mod utils;
mod workspace;

use crate::app_state::AppState;
use crate::connector::*;
use crate::data::Dynamodb;
use crate::layer::*;
use crate::project::*;
use crate::session::*;
use crate::user::*;
use crate::workspace::*;

use anyhow::Result;
use dotenvy::dotenv;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialise tracing
    tracing_subscriber::fmt().with_ansi(false).init();
    // Load environment variables from .env file
    dotenv().ok();

    let app_db = Dynamodb::new().await.unwrap();

    // Create GeospatialConnections
    let active_connections = ActiveConnections::new();

    // Create initial App State
    let app_state = AppState {
        app_data: app_db,
        connections: active_connections,
    };

    // Generate random UUID to suppress get_connection_id warning for now
    let random_uuid = uuid::Uuid::new_v4();
    // Check for primary connection info in app_data and add to geo_connections if found
    let geoconnection_record_primary = app_state.app_data.get_connection(&random_uuid).await;
    match geoconnection_record_primary {
        Ok(geoconnection_primary) => {
            info!("Primary connection found");
            let postgis_connector = PostgisConnector::new(geoconnection_primary).unwrap();
            app_state
                .connections
                .add_connection(random_uuid, postgis_connector)
                .await;
        }
        Err(_) => return Err(anyhow::anyhow!("Primary connection not found")),
    }

    // Run app
    let app = server::create_app(app_state);
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await?;
    info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}
