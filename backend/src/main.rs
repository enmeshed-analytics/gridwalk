use anyhow::Result;
use rustls;
use std::collections::HashMap;
use tracing::info;

use gridwalk_backend::{app_state::AppState, config, server};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .unwrap();

    // Initialize PgConfig and sources
    let tile_info_sources = config::initialize_pg_config().await?;
    let mut sources: HashMap<String, Box<dyn martin::Source>> = HashMap::new();
    for source in tile_info_sources {
        let id = source.get_id().to_string();
        sources.insert(id, source);
    }

    let app_state = AppState { sources };
    let app = server::create_app(app_state);

    // Run our app with hyper
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001").await?;
    info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}

