use crate::app_state::AppState;
use crate::core::Connection;
//use crate::data::Database;
use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
//use martin_tile_utils::TileCoord;
use std::sync::Arc;

pub async fn tiles(
    State(state): State<Arc<AppState>>,
    Path((workspace_id, connection_id, z, x, y)): Path<(String, String, u32, u32, u32)>,
) -> impl IntoResponse {
    let connection = Connection::from_id(&state.app_data, &workspace_id, &connection_id)
        .await
        .unwrap();

    let geoconnector = state
        .geospatial_config
        .get_connection(&connection.id)
        .await
        .unwrap();

    let tile = geoconnector.get_tile(z, x, y).await.unwrap();

    println!("tile");
    println!("{tile:?}");

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/x-protobuf")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3000")
        .header(
            header::ACCESS_CONTROL_ALLOW_METHODS,
            "GET, POST, PUT, DELETE, OPTIONS",
        )
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
        //.header(header::CONTENT_ENCODING, "gzip")
        .body(axum::body::Body::from(tile))
        .unwrap()
        .into_response()

    //if let Some(tile_info_source) = state.geospatial_config.get("pois") {
    //    let xyz = TileCoord {
    //        x,
    //        y,
    //        z: z.try_into().unwrap(),
    //    };
    //    match tile_info_source.get_tile(xyz, None).await {
    //        Ok(tile_data) => (
    //            StatusCode::OK,
    //            [
    //                (header::CONTENT_TYPE, "application/vnd.mapbox-vector-tile"),
    //                (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
    //            ],
    //            tile_data,
    //        )
    //            .into_response(),
    //        Err(_) => (StatusCode::NOT_FOUND, "Tile not found".to_string()).into_response(),
    //    }
    //} else {
    //    (
    //        StatusCode::NOT_FOUND,
    //        "Tile info source not found".to_string(),
    //    )
    //        .into_response()
    //}
}
