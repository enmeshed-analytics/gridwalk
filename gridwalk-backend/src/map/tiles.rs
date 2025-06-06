use crate::error::ApiError;
use crate::{AppState, WorkspaceMember};
use crate::{Layer, Session, User, Workspace};
use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
use std::str::FromStr;
use std::sync::Arc;
use tower_cookies::Cookies;
use tracing::error;
use uuid::Uuid;

// TODO: Create cache for session/layer permissions to prevent repeated requests to DB

pub async fn tiles(
    State(state): State<Arc<AppState>>,
    cookies: Cookies,
    Path((layer_id, z, x, y)): Path<(Uuid, u32, u32, u32)>,
) -> Result<impl IntoResponse, ApiError> {
    let token = cookies.get("sid").unwrap().value().to_string();
    let session_id = match Uuid::from_str(&token) {
        Ok(id) => id,
        Err(_) => return Err(ApiError::Unauthorized),
    };

    let session = match Session::from_id(&*state.pool, &session_id).await {
        Ok(session) => session,
        Err(_) => return Err(ApiError::Unauthorized),
    };

    // TODO: Get user and workspace in a single transaction
    // Get the user
    let user = match User::from_id(&*state.pool, &session.user_id).await {
        Ok(user) => user,
        Err(_) => return Err(ApiError::InternalServerError),
    };

    let layer = match Layer::from_id(&*state.pool, &layer_id).await {
        Ok(layer) => layer,
        Err(_) => return Err(ApiError::NotFound("Layer not found".to_string())),
    };

    // Get the workspace
    let workspace = match Workspace::from_id(&*state.pool, &layer.workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return Err(ApiError::NotFound("Workspace not found".to_string())),
    };

    // TODO: Optimise this to remove need for workspace query
    // Check if user is a member of the workspace
    WorkspaceMember::get(&*state.pool, &workspace, &user)
        .await
        .map_err(|_| {
            error!("User is not a member of the workspace: {:?}", workspace.id);
            ApiError::Unauthorized
        })?;

    // TODO: Removed connection sharing logic. Use Layer sharing across workspaces instead

    // TODO: Look at caching the above to reduce db calls

    let connector = state
        .connections
        .get_connection(&layer.connection_id)
        .map_err(|_| {
            error!("Connection not found: {:?}", layer.connection_id);
            ApiError::InternalServerError
        })?;

    let connector = match connector.as_vector_connector() {
        Some(vc) => vc,
        None => return Err(ApiError::InternalServerError),
    };

    let tile = connector.get_tile(&layer_id, z, x, y).await.unwrap();

    let res = Response::builder()
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
        .into_response();

    Ok(res)
}

// TODO: Fix this. There is no auth
pub async fn get_geometry_type(
    State(state): State<Arc<AppState>>,
    Path(source_id): Path<Uuid>,
) -> impl IntoResponse {
    let layer = Layer::from_id(&*state.pool, &source_id).await.unwrap();
    let connection = state
        .connections
        .get_connection(&layer.connection_id)
        .unwrap();

    let vector_connector = if let Some(vc) = connection.as_vector_connector() {
        vc
    } else {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Connection is not a vector connector",
        )
            .into_response();
    };

    // Get the geometry type and convert it to a string
    match vector_connector.get_geometry_type(&source_id).await {
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
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to get geometry type",
        )
            .into_response(),
    }
}
