use crate::auth::AuthUser;
use crate::AppState;
use crate::{
    ConnectionConfig, User, Workspace, WorkspaceConnectionAccess, WorkspaceMember, WorkspaceRole,
};
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

pub async fn create_workspace(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqCreateWorkspace>,
) -> impl IntoResponse {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    };

    let new_workspace = Workspace::from_req(req);
    match new_workspace.save(&state.app_data, &user).await {
        Ok(_) => Json(json!({ "workspace_id": new_workspace.id })).into_response(),
        Err(_) => "workspace not created".into_response(),
    }
}

// TODO: fix response types
pub async fn delete_workspace(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> impl IntoResponse {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    };

    // Retrieve the workspace
    let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return "workspace not found".into_response(),
    };

    // Check if the user is a member of the workspace
    let member = match workspace.get_member(&state.app_data, &user).await {
        Ok(m) => m,
        Err(_) => return "unauthorized".into_response(),
    };

    // Check if the user is an admin
    if member.role != WorkspaceRole::Admin {
        return (StatusCode::FORBIDDEN, "unauthorized".into_response()).into_response();
    }

    // Delete the workspace
    match workspace.delete(&state.app_data).await {
        Ok(_) => return (StatusCode::OK, "workspace deleted").into_response(),
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to delete workspace",
            )
                .into_response()
        }
    }
}

pub async fn add_workspace_member(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqAddWorkspaceMember>,
) -> impl IntoResponse {
    let requesting_user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    };

    // Get the target user by email
    let user_to_add = match User::from_email(&state.app_data, &req.email).await {
        Ok(user) => user,
        Err(_) => return (StatusCode::NOT_FOUND, "User not found.").into_response(),
    };

    // Get the workspace
    let workspace = match Workspace::from_id(&state.app_data, &req.workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return (StatusCode::NOT_FOUND, "Workspace not found").into_response(),
    };

    let workspace_id = workspace.id;
    let workspace_name = workspace.name.clone();

    match workspace
        .add_member(&state.app_data, &requesting_user, &user_to_add, req.role)
        .await
    {
        Ok(_) => {
            tracing::info!(
                "User {} added to workspace {} ({}) by {}",
                user_to_add.email,
                workspace_name,
                workspace_id,
                requesting_user.email
            );
            (
                StatusCode::OK,
                Json(json!({
                    "message": "Member added successfully"
                })),
            )
                .into_response()
        }
        Err(e) => {
            let error_message = e.to_string();
            tracing::warn!(
                "Failed to add user {} to workspace {}: {}",
                user_to_add.email,
                workspace_id,
                error_message
            );

            if error_message.contains("Only Admin can add members") {
                (
                    StatusCode::FORBIDDEN,
                    Json(json!({
                        "error": "Only workspace administrators can add members"
                    })),
                )
                    .into_response()
            } else if error_message.contains("not found") || error_message.contains("member") {
                (
                    StatusCode::FORBIDDEN,
                    Json(json!({
                        "error": "You are not a member of this workspace"
                    })),
                )
                    .into_response()
            } else {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({
                        "error": "Failed to add member to workspace"
                    })),
                )
                    .into_response()
            }
        }
    }
}

pub async fn remove_workspace_member(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqRemoveWorkspaceMember>,
) -> impl IntoResponse {
    let requesting_user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    };

    let workspace = match Workspace::from_id(&state.app_data, &req.workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return (StatusCode::FORBIDDEN, "workspace not found").into_response(),
    };

    // Check if the requesting user is a member of the workspace
    let requesting_member = match workspace
        .get_member(&state.app_data, &requesting_user)
        .await
    {
        Ok(m) => m,
        Err(_) => return (StatusCode::FORBIDDEN, "unauthorized").into_response(),
    };

    // Get the user to remove by email
    let user = match User::from_email(&state.app_data, &req.email).await {
        Ok(user) => user,
        Err(_) => return (StatusCode::NOT_FOUND, "User not found.").into_response(),
    };

    // Remove workspace member
    match workspace
        .remove_member(&state.app_data, &requesting_member, &user)
        .await
    {
        Ok(_) => "removed workspace member".into_response(),
        Err(_) => "failed to remove member".into_response(),
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

// For a workspace with a given connection_id, list all data sources
// e.g. tables, views, etc.
pub async fn list_sources(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((workspace_id, connection_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => {
            return (StatusCode::NOT_FOUND, "Workspace not found".to_string()).into_response()
        }
    };

    match WorkspaceMember::get(&state.app_data, &workspace, &user).await {
        Ok(_member) => {}
        Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    }

    match WorkspaceConnectionAccess::get(&state.app_data, &workspace, &connection_id).await {
        Ok(_access) => {}
        Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    }

    let connection = state.connections.get_connection(&connection_id).unwrap();

    match connection.list_sources(&workspace.id).await {
        Ok(sources) => Json(sources).into_response(),
        Err(e) => {
            eprintln!("Error listing sources: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to list sources".to_string(),
            )
                .into_response()
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionResponse {
    pub id: String,
    pub name: String,
    pub connector_type: String,
    pub tenancy: String,
}

// TODO: Switch to using Connection after retrieving the connection from the database
impl From<ConnectionConfig> for ConnectionResponse {
    fn from(con: ConnectionConfig) -> Self {
        ConnectionResponse {
            id: con.id.to_string(),
            name: con.name,
            connector_type: con.config.to_string(),
            tenancy: con.tenancy.to_string(),
        }
    }
}

// List all accessible connections for a given workspace
pub async fn list_connections(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> impl IntoResponse {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    };

    let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => {
            return (StatusCode::NOT_FOUND, "Workspace not found".to_string()).into_response()
        }
    };

    // Check if the requesting user is a member of the workspace
    match WorkspaceMember::get(&state.app_data, &workspace, &user).await {
        Ok(_member) => {}
        Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    }

    let connection_access_list = WorkspaceConnectionAccess::get_all(&state.app_data, &workspace)
        .await
        .ok()
        .unwrap();

    // Convert Vec<Connection> to Vec<ConnectionResponse>
    // Removes the config from the response
    let connection_responses: Vec<ConnectionResponse> = connection_access_list
        .into_iter()
        .map(ConnectionResponse::from)
        .collect();

    Json(connection_responses).into_response()
}
