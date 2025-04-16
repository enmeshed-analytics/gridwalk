use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::{User, Workspace, WorkspaceRole};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use futures;
use futures::stream::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Serialize)]
pub struct ErrorResponse {
    error: String,
}

#[derive(Debug, Deserialize)]
pub struct ReqCreateWorkspace {
    name: String,
}

#[derive(Debug, Deserialize)]
pub struct ReqAddWorkspaceMember {
    workspace_id: Uuid,
    email: String,
    role: WorkspaceRole,
}

#[derive(Debug, Deserialize)]
pub struct ReqRemoveWorkspaceMember {
    workspace_id: Uuid,
    email: String,
}

#[derive(Debug, Serialize)]
pub struct SimpleMemberResponse {
    role: WorkspaceRole,
    email: String,
}

impl Workspace {
    pub fn from_req(req: ReqCreateWorkspace) -> Self {
        Workspace {
            id: Uuid::new_v4(),
            name: req.name,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            active: true,
        }
    }
}

// TODO: fix response types
pub async fn create_workspace(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqCreateWorkspace>,
) -> Response {
    if let Some(user) = auth_user.user {
        let new_workspace = Workspace::from_req(req);
        match new_workspace.save(&state.app_data, &user).await {
            Ok(_) => Json(json!({ "workspace_id": new_workspace.id })).into_response(),
            Err(_) => "workspace not created".into_response(),
        }
    } else {
        "workspace not created".into_response()
    }
}

// TODO: fix response types
pub async fn delete_workspace(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Response {
    if let Some(req_user) = auth_user.user {
        // Retrieve the workspace
        let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
            Ok(ws) => ws,
            Err(_) => return "workspace not found".into_response(),
        };

        // Check if the user is a member of the workspace
        let member = match workspace.get_member(&state.app_data, &req_user).await {
            Ok(m) => m,
            Err(_) => return "unauthorized".into_response(),
        };

        // Check if the user is an admin
        if member.role == WorkspaceRole::Admin {
            // Delete the workspace
            match workspace.delete(&state.app_data).await {
                Ok(_) => "workspace deleted".into_response(),
                Err(_) => "failed to delete workspace".into_response(),
            }
        } else {
            "unauthorized".into_response()
        }
    } else {
        "unauthorised".into_response()
    }
}

pub async fn add_workspace_member(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqAddWorkspaceMember>,
) -> Response {
    if let Some(req_user) = auth_user.user {
        // Get the target user by email
        let user_to_add = match User::from_email(&state.app_data, &req.email).await {
            Ok(user) => user,
            Err(_) => return "user not found".into_response(),
        };

        // Get the workspace
        let workspace = match Workspace::from_id(&state.app_data, &req.workspace_id).await {
            Ok(ws) => ws,
            Err(_) => return "workspace not found".into_response(),
        };

        // Add memeber workspace
        match workspace
            .add_member(&state.app_data, &req_user, &user_to_add, req.role)
            .await
        {
            Ok(_) => "member added to workspace successfully".into_response(),
            Err(_) => "failed to add member to workspace".into_response(),
        }
    } else {
        "unauthorized".into_response()
    }
}

pub async fn remove_workspace_member(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqRemoveWorkspaceMember>,
) -> Response {
    if let Some(req_user) = auth_user.user {
        // Get the workspace
        let wsp = match Workspace::from_id(&state.app_data, &req.workspace_id).await {
            Ok(ws) => ws,
            Err(_) => return "workspace not found".into_response(),
        };

        // Get the user to remove by email instead of id
        let user = match User::from_email(&state.app_data, &req.email).await {
            Ok(user) => user,
            Err(_) => return "user not found".into_response(),
        };

        // Remove workspace member
        match wsp.remove_member(&state.app_data, &req_user, &user).await {
            Ok(_) => "removed workspace member".into_response(),
            Err(_) => "failed to remove member".into_response(),
        }
    } else {
        "unauthorized".into_response()
    }
}

pub async fn get_workspace_members(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> impl IntoResponse {
    let req_user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Get the workspace
    let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => {
            let error = ErrorResponse {
                error: "Workspace not found".to_string(),
            };
            return Json(error).into_response();
        }
    };

    //
    if let Ok(_member) = workspace.get_member(&state.app_data, &req_user).await {
        // Get all members and transform to simplified response
        match workspace.get_members(&state.app_data).await {
            Ok(members) => {
                let users: Vec<SimpleMemberResponse> = futures::stream::iter(members)
                    .then(|m| {
                        let state_clone = state.clone();
                        async move {
                            if let Ok(user) = User::from_id(&state_clone.app_data, &m.user_id).await
                            {
                                SimpleMemberResponse {
                                    role: m.role,
                                    email: user.email,
                                }
                            } else {
                                SimpleMemberResponse {
                                    role: m.role,
                                    email: "unknown".to_string(),
                                }
                            }
                        }
                    })
                    .collect()
                    .await;

                Json(users).into_response()
            }
            Err(_) => {
                let error = ErrorResponse {
                    error: "Failed to fetch workspace members".to_string(),
                };
                Json(error).into_response()
            }
        }
    } else {
        let error = ErrorResponse {
            error: "Unauthorized to view workspace members".to_string(),
        };
        Json(error).into_response()
    }
}

pub async fn get_workspaces(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Response {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    match Workspace::get_user_workspaces(&state.app_data, &user).await {
        Ok(workspaces) => Json(workspaces).into_response(),
        Err(_) => {
            let error = ErrorResponse {
                error: "Failed to fetch workspaces".to_string(),
            };
            Json(error).into_response()
        }
    }
}

pub async fn get_workspace(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Response {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(workspace) => {
            if let Ok(_member) = workspace.get_member(&state.app_data, &user).await {
                Json(workspace).into_response()
            } else {
                let error = ErrorResponse {
                    error: "Unauthorized".to_string(),
                };
                Json(error).into_response()
            }
        }
        Err(_) => {
            let error = ErrorResponse {
                error: "Workspace not found".to_string(),
            };
            Json(error).into_response()
        }
    }
}
