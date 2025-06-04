use crate::auth::AuthUser;
use crate::error::ApiError;
use crate::{AppState, WorkspaceMember};
use crate::{Project, Workspace, WorkspaceRole};
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
pub struct CreateProjectReq {
    pub name: String,
}

pub async fn create_project(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
    Json(req): Json<CreateProjectReq>,
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

    // Only workspace admins and owners can create projects
    if member.role != WorkspaceRole::Admin && member.role != WorkspaceRole::Owner {
        error!(
            "User does not have permission to create projects in workspace: {:?}",
            workspace_id
        );
        return Err(ApiError::Unauthorized);
    }

    // Create project struct from request
    let project = Project::new(&workspace, &user, req.name);

    match project.save(&*state.pool).await {
        Ok(_) => Ok((StatusCode::CREATED, Json(project)).into_response()),
        Err(e) => {
            error!("Failed to create project: {:?}", e);
            Err(ApiError::InternalServerError)
        }
    }
}

pub async fn get_projects(
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

    debug!("Fetching projects for workspace: {:?}", workspace_id);
    let projects = Project::all_for_workspace(&*state.pool, &workspace)
        .await
        .map_err(|e| {
            error!("Failed to fetch projects: {:?}", e);
            ApiError::InternalServerError
        })?;

    Ok(Json(projects).into_response())
}

// TODO: Fix dangling resources
pub async fn delete_project(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path((workspace_id, project_id)): Path<(Uuid, Uuid)>,
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

    // Only workspace admins and owners can delete projects. Non-members cannot see existence.
    match WorkspaceMember::get(&*state.pool, &workspace, &user).await {
        Ok(member) if matches!(member.role, WorkspaceRole::Owner | WorkspaceRole::Admin) => {}
        Ok(_) => return Err(ApiError::Unauthorized),
        Err(_) => return Err(ApiError::NotFound("Workspace not found".to_string())),
    }

    let project = match Project::get(&*state.pool, &workspace_id, &project_id).await {
        Ok(project) => project,
        Err(_) => return Err(ApiError::NotFound("Project not found".to_string())),
    };

    match project.delete(&*state.pool).await {
        Ok(_) => {
            debug!("Project deleted successfully: {:?}", project_id);
            Ok(StatusCode::NO_CONTENT.into_response())
        }
        Err(e) => {
            error!("Failed to delete project: {:?}", e);
            Err(ApiError::InternalServerError)
        }
    }
}
