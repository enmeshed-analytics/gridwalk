use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::core::{ConnectionAccess, Workspace};
use axum::{
    extract::{Extension, Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
//use martin_tile_utils::TileCoord;
use std::sync::Arc;

pub async fn tiles(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((workspace_id, source_name, connection_id, z, x, y)): Path<(
        String,
        String,
        String,
        u32,
        u32,
        u32,
    )>,
) -> impl IntoResponse {
    let _user = auth_user
        .user
        .as_ref()
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, ""));

    // Get the workspace
    let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return "workspace not found".into_response(),
    };

    // Check if user is a member of the workspace
    let _workspace_member = workspace
        .get_member(&state.app_data, &auth_user.user.unwrap())
        .await
        .map_err(|_| (StatusCode::FORBIDDEN, ""));

    // Check if workspace has access to the connection namespace
    let _connection_access = ConnectionAccess::get(&state.app_data, &workspace, &connection_id)
        .await
        .map_err(|_| (StatusCode::NOT_FOUND, ""));

    let geoconnector = state
        .geo_connections
        .get_connection(&connection_id)
        .await
        .unwrap();

    let tile = geoconnector
        .get_tile(&workspace_id, &source_name, z, x, y)
        .await
        .unwrap();

    //println!("tile");
    //println!("{tile:?}");

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
