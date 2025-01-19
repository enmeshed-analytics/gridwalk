use crate::app_state::AppState;
use crate::core::{ConnectionAccess, Session, User, Workspace};
use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
use std::sync::Arc;
use tower_cookies::Cookies;

// TODO: Create cache for tile source/session to prevent repeated requests to DB

pub async fn tiles(
    State(state): State<Arc<AppState>>,
    cookies: Cookies,
    Path((workspace_id, connection_id, source_name, z, x, y)): Path<(
        String,
        String,
        String,
        u32,
        u32,
        u32,
    )>,
) -> impl IntoResponse {
    let token = cookies.get("sid").unwrap().value().to_string();

    let session = match Session::from_id(&state.app_data, &token).await {
        Ok(session) => session,
        Err(_) => return (StatusCode::UNAUTHORIZED, "").into_response(),
    };

    // Do not allow unauthenticated users for now
    if session.user_id.is_none() {
        return (StatusCode::UNAUTHORIZED, "").into_response();
    }

    // TODO: Get user and workspace in a single transaction
    // Get the user
    let user = match User::from_id(&state.app_data, &session.user_id.unwrap()).await {
        Ok(user) => user,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "").into_response(),
    };

    // Get the workspace
    let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return "workspace not found".into_response(),
    };

    // TODO: Optimise this to remove need for workspace query
    // Check if user is a member of the workspace
    let _workspace_member = workspace
        .get_member(&state.app_data, &user)
        .await
        .map_err(|_| (StatusCode::FORBIDDEN, ""));

    // TODO: Add to same transaction as above
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
}

pub async fn get_geometry_type(
    State(state): State<Arc<AppState>>,
    Path((workspace_id, connection_id, source_name)): Path<(String, String, String)>,
) -> impl IntoResponse {
    let geoconnector = state
        .geo_connections
        .get_connection(&connection_id)
        .await
        .unwrap();

    // Get the geometry type and convert it to a string
    match geoconnector.get_geometry_type(&workspace_id, &source_name).await {
        Ok(geom_type) => {
            let geom_type_str = format!("{:?}", geom_type);
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "text/plain")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3000")
                .header(
                    header::ACCESS_CONTROL_ALLOW_METHODS,
                    "GET, POST, PUT, DELETE, OPTIONS",
                )
                .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
                .body(axum::body::Body::from(geom_type_str))
                .unwrap()
                .into_response()
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get geometry type").into_response(),
    }
}
