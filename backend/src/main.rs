use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use martin::pg::PgConfig;
use martin::{IdResolver, OptBoolObj, Source};
use martin_tile_utils::TileCoord;
use rustls;
use std::collections::HashMap;
use tower_http::trace::{self, TraceLayer};
use tracing::{info, Level};

#[derive(Clone)]
struct AppState {
    sources: HashMap<String, Box<dyn Source>>,
}

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

    for source in tile_info_sources {
        let id = source.get_id().to_string();

        // Insert into the HashMap
        sources.insert(id, source);
    }
    let app_state = AppState { sources };

    // Build our application with a route
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/tiles/:z/:x/:y", get(tiles)) // Add your handler route
        .with_state(app_state)
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(trace::DefaultMakeSpan::new().level(Level::INFO))
                .on_response(trace::DefaultOnResponse::new().level(Level::INFO)),
        );

    // Run our app with hyper
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001").await?;
    info!("Server listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "healthy" }))
}

async fn tiles(Path((z, y, x)): Path<(u32, u32, u32)>, State(state): State<AppState>) -> Response {
    if let Some(tile_info_source) = state.sources.get("pois") {
        let xyz = TileCoord {
            x,
            y,
            z: z.try_into().unwrap(),
        };

        match tile_info_source.get_tile(xyz, None).await {
            Ok(tile_data) => {
                // Create a response with the tile data and appropriate headers
                (
                    StatusCode::OK,
                    [
                        (header::CONTENT_TYPE, "application/vnd.mapbox-vector-tile"),
                        (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
                    ],
                    tile_data,
                )
                    .into_response()
            }
            Err(_) => (StatusCode::NOT_FOUND, "Tile not found".to_string()).into_response(),
        }
    } else {
        (
            StatusCode::NOT_FOUND,
            "Tile info source not found".to_string(),
        )
            .into_response()
    }
}
