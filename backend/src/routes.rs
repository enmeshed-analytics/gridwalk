use crate::app_state::AppState;
use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use martin_tile_utils::TileCoord;

pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "healthy" }))
}

pub async fn tiles(
    Path((z, y, x)): Path<(u32, u32, u32)>,
    State(state): State<AppState>,
) -> Response {
    if let Some(tile_info_source) = state.sources.get("pois") {
        let xyz = TileCoord {
            x,
            y,
            z: z.try_into().unwrap(),
        };
        match tile_info_source.get_tile(xyz, None).await {
            Ok(tile_data) => (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "application/vnd.mapbox-vector-tile"),
                    (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
                ],
                tile_data,
            )
                .into_response(),
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
