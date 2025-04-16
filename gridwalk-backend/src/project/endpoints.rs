use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::{CreateProject, Project, User, Workspace, WorkspaceRole};
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
    Json(req): Json<CreateProject>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Ensure user is authenticated
    let user = auth_user.user.as_ref().ok_or_else(|| {
        let error = json!({
            "error": "Unauthorized request",
            "details": null
        });
        (StatusCode::UNAUTHORIZED, Json(error))
    })?;

    // Create project from request
    let project = Project::from_req(req, user);

    // Process project
    match process_project(&state, &project, user).await {
        Ok(json_response) => Ok((StatusCode::OK, Json(json_response))),
        Err(e) => Err(e),
    }
}

async fn process_project(
    state: &Arc<AppState>,
    project: &Project,
    user: &User,
) -> Result<serde_json::Value, (StatusCode, Json<serde_json::Value>)> {
    // Validate workspace access
    let workspace = Workspace::from_id(&state.app_data, &project.workspace_id)
        .await
        .map_err(|e| {
            let error = json!({
                "error": "Workspace not found",
                "details": e.to_string()
            });
            (StatusCode::NOT_FOUND, Json(error))
        })?;

    // Get workspace member and check permissions
    let member = workspace
        .get_member(&state.app_data, user)
        .await
        .map_err(|e| {
            let error = json!({
                "error": "Access forbidden",
                "details": e.to_string()
            });
            (StatusCode::FORBIDDEN, Json(error))
        })?;

    // Verify write permissions
    if member.role == WorkspaceRole::Read {
        let error = json!({
            "error": "Read-only access",
            "details": "User does not have write permission"
        });
        return Err((StatusCode::FORBIDDEN, Json(error)));
    }

    // Write project record to database
    project
        .write_project_record(&state.app_data)
        .await
        .map_err(|e| {
            let error = json!({
                "error": "Failed to write project record to Database",
                "details": e.to_string()
            });
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error))
        })?;

    // Return success response with created project
    Ok(serde_json::to_value(project).unwrap_or_else(|_| {
        json!({
            "status": "success",
            "message": "Project created successfully",
            "project_id": project.id,
            "workspace_id": project.workspace_id
        })
    }))
}

// TODO: Fix auth. Anyone can see all projects
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
        Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
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
