use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::core::{CreateProject, Project, User, Workspace, WorkspaceRole};
use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;
use std::sync::Arc;

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
