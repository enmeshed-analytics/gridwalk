mod app_state;
mod core;
mod data;
mod routes;
mod server;
use crate::app_state::AppState;
use crate::data::Dynamodb;

use anyhow::Result;
use martin::{pg::PgConfig, IdResolver, OptBoolObj, Source};
use rustls;
use std::collections::HashMap;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .unwrap();

    // MARTIN CODE
    let mut pg_config = PgConfig {
        connection_string: Some("postgresql://admin:password@localhost:5432/gridwalk".to_string()),
        auto_publish: OptBoolObj::Bool(true),
        ..Default::default()
    };
    pg_config.finalize().unwrap();
    let tile_info_sources = pg_config.resolve(IdResolver::default()).await.unwrap();
    let mut sources: HashMap<String, Box<dyn Source>> = HashMap::new();

    // Split tile sources into hashmap
    for source in tile_info_sources {
        let id = source.get_id().to_string();
        // Insert into the HashMap
        sources.insert(id, source);
    }

    // Create DynamoDB client
    let app_db = Dynamodb::new(true, &"gridwalk").await.unwrap();

    // Create AppState with DynamoDB client as app_data
    let app_state = AppState {
        app_data: app_db,
        sources,
    };

    // Run app
    let app = server::create_app(app_state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001").await?;
    info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}

