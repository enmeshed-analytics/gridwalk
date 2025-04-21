use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::{CreateProject, Project, Workspace, WorkspaceRole};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;
use tracing::debug;
use uuid::Uuid;

#[derive(Serialize)]
pub struct ErrorResponse {
    error: String,
}

pub async fn create_project(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
    Json(req): Json<CreateProject>,
) -> impl IntoResponse {
    // Ensure user is authenticated
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Create project struct from request
    let project = Project::from_req(req, &workspace_id, &user);

    let workspace = match Workspace::from_id(&state.app_data, &project.workspace_id).await {
        Ok(ws) => ws,
        Err(_) => {
            let error = json!({
                "error": "Workspace not found",
                "workspace_id": project.workspace_id
            });
            return (StatusCode::NOT_FOUND, Json(error)).into_response();
        }
    };

    let member = match workspace.get_member(&state.app_data, &user).await {
        Ok(member) => member,
        Err(_) => {
            let error = json!({
                "error": "Access forbidden",
                "workspace_id": project.workspace_id
            });
            return (StatusCode::FORBIDDEN, Json(error)).into_response();
        }
    };

    if member.role != WorkspaceRole::Admin {
        let error = json!({
            "error": "Only workspace admins can create projects",
            "workspace_id": project.workspace_id
        });
        return (StatusCode::FORBIDDEN, Json(error)).into_response();
    }

    match project.save(&state.app_data).await {
        Ok(_) => return (StatusCode::CREATED, Json(project)).into_response(),
        Err(e) => {
            let error = json!({
                "error": "Failed to create project",
                "details": e.to_string()
            });
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(error)).into_response();
        }
    }
}

pub async fn get_projects(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Response {
    let req_user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // All member roles can view projects, continue if record exists.
    match workspace.get_member(&state.app_data, &req_user).await {
        Ok(member) => member,
        Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    debug!("Fetching projects for workspace: {:?}", workspace_id);
    let projects = match Project::get_workspace_projects(&state.app_data, &workspace).await {
        Ok(projects) => projects,
        Err(_) => {
            let error = ErrorResponse {
                error: "Failed to fetch projects".to_string(),
            };
            return Json(error).into_response();
        }
    };

    Json(projects).into_response()
}

pub async fn delete_project(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((workspace_id, project_id)): Path<(Uuid, Uuid)>,
) -> Response {
    // Ensure user is authenticated
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // First validate workspace access and permissions
    // This ensures user can't probe for workspace existence without access
    let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    let member = match workspace.get_member(&state.app_data, &user).await {
        Ok(member) => member,
        Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    if member.role != WorkspaceRole::Admin {
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    let project = match Project::get(&state.app_data, &workspace_id, &project_id).await {
        Ok(project) => project,
        Err(_) => return (StatusCode::NOT_FOUND, "Not Found.").into_response(),
    };

    match project.delete(&state.app_data).await {
        Ok(_) => debug!("Project deleted successfully"),
        Err(e) => {
            debug!("Failed to delete project: {:?}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to delete project",
            )
                .into_response();
        }
    }

    (
        StatusCode::OK,
        Json(json!({"status": "success", "message": "Project deleted successfully"})),
    )
        .into_response()
}
