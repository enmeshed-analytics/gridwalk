use crate::auth::AuthUser;
use crate::error::ApiError;
use crate::{AppState, WorkspaceMember};
use crate::{Map, Workspace, WorkspaceRole};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, error};
use uuid::Uuid;

#[derive(Serialize)]
pub struct ErrorResponse {
    error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMapReq {
    pub name: String,
}

pub async fn create_map(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
    Json(req): Json<CreateMapReq>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    let workspace = Workspace::from_id(&*state.pool, &workspace_id)
        .await
        .map_err(|_| {
            error!("Workspace not found: {:?}", workspace_id);
            ApiError::NotFound("Workspace not found".to_string())
        })?;

    // Check if user is a member of the workspace
    let member = WorkspaceMember::get(&*state.pool, &workspace, &user)
        .await
        .map_err(|_| {
            error!("User is not a member of the workspace: {:?}", workspace_id);
            ApiError::Unauthorized
        })?;

    // Only workspace admins and owners can create maps
    if member.role != WorkspaceRole::Admin && member.role != WorkspaceRole::Owner {
        error!(
            "User does not have permission to create maps in workspace: {:?}",
            workspace_id
        );
        return Err(ApiError::Unauthorized);
    }

    // Create map struct from request
    let map = Map::new(&workspace, &user, req.name);

    match map.save(&*state.pool).await {
        Ok(_) => Ok((StatusCode::CREATED, Json(map)).into_response()),
        Err(e) => {
            error!("Failed to create map: {:?}", e);
            Err(ApiError::InternalServerError)
        }
    }
}

pub async fn get_maps(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    let workspace = Workspace::from_id(&*state.pool, &workspace_id)
        .await
        .map_err(|_| {
            error!("Workspace not found: {:?}", workspace_id);
            ApiError::NotFound("Workspace not found".to_string())
        })?;

    // Check if user is a member of the workspace
    WorkspaceMember::get(&*state.pool, &workspace, &user)
        .await
        .map_err(|_| {
            error!("User is not a member of the workspace: {:?}", workspace_id);
            ApiError::Unauthorized
        })?;

    debug!("Fetching maps for workspace: {:?}", workspace_id);
    let maps = Map::all_for_workspace(&*state.pool, &workspace)
        .await
        .map_err(|e| {
            error!("Failed to fetch maps: {:?}", e);
            ApiError::InternalServerError
        })?;

    Ok(Json(maps).into_response())
}

// TODO: Fix dangling resources
pub async fn delete_map(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path((workspace_id, map_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    // First validate workspace access and permissions
    // This ensures user can't probe for workspace existence without access
    let workspace = match Workspace::from_id(&*state.pool, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return Err(ApiError::NotFound("Workspace not found".to_string())),
    };

    // Only workspace admins and owners can delete maps. Non-members cannot see existence.
    match WorkspaceMember::get(&*state.pool, &workspace, &user).await {
        Ok(member) if matches!(member.role, WorkspaceRole::Owner | WorkspaceRole::Admin) => {}
        Ok(_) => return Err(ApiError::Unauthorized),
        Err(_) => return Err(ApiError::NotFound("Workspace not found".to_string())),
    }

    let map = match Map::get(&*state.pool, &workspace_id, &map_id).await {
        Ok(map) => map,
        Err(_) => return Err(ApiError::NotFound("Map not found".to_string())),
    };

    match map.delete(&*state.pool).await {
        Ok(_) => {
            debug!("map deleted successfully: {:?}", map_id);
            Ok(StatusCode::NO_CONTENT.into_response())
        }
        Err(e) => {
            error!("Failed to delete map: {:?}", e);
            Err(ApiError::InternalServerError)
        }
    }
}
