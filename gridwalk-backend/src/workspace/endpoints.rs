use crate::auth::AuthUser;
use crate::{app_state::AppState, utils::get_unix_timestamp};
use crate::{User, Workspace, WorkspaceRole};
use axum::{
    extract::{Extension, Path, State},
    response::{IntoResponse, Response},
    Json,
};
use futures;
use futures::future::join_all;
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
    workspace_id: String,
    email: String,
    role: WorkspaceRole,
}

#[derive(Debug, Deserialize)]
pub struct ReqRemoveWorkspaceMember {
    workspace_id: String,
    email: String,
}

#[derive(Debug, Serialize)]
pub struct SimpleMemberResponse {
    role: WorkspaceRole,
    email: String,
}

impl Workspace {
    pub fn from_req(req: ReqCreateWorkspace, owner: String) -> Self {
        Workspace {
            id: Uuid::new_v4().to_string(),
            name: req.name,
            owner,
            created_at: get_unix_timestamp(),
            active: true,
        }
    }
}

// TODO: Create all records within a transaction
pub async fn create_workspace(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqCreateWorkspace>,
) -> Response {
    if let Some(owner) = auth_user.user {
        let wsp = Workspace::from_req(req, owner.clone().id);
        let primary_connection = state
            .geo_connections
            .get_connection("primary")
            .await
            .unwrap();
        match Workspace::create(&state.app_data, &primary_connection, &wsp).await {
            Ok(_) => {
                let now = get_unix_timestamp();
                // TODO: Handle response from adding member
                let _ = state
                    .app_data
                    .add_workspace_member(&wsp, &owner, WorkspaceRole::Admin, now)
                    .await;
                Json(json!({ "workspace_id": wsp.id })).into_response()
            }
            Err(_) => "workspace not created".into_response(),
        }
    } else {
        "workspace not created".into_response()
    }
}

pub async fn delete_workspace(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<String>,
) -> Response {
    if let Some(req_user) = auth_user.user {
        // Retrieve the workspace to ensure it exists and check permissions
        if let Ok(workspace) = Workspace::from_id(&state.app_data, &workspace_id).await {
            if workspace.owner == req_user.id {
                // Ensure the user is the owner
                match Workspace::delete(&state.app_data, &workspace_id).await {
                    Ok(_) => "workspace deleted successfully".into_response(),
                    Err(_) => "failed to delete workspace".into_response(),
                }
            } else {
                "unauthorised to delete this workspace".into_response()
            }
        } else {
            "workspace not found".into_response()
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
    Path(workspace_id): Path<String>,
) -> impl IntoResponse {
    if let Some(req_user) = auth_user.user {
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
                                if let Ok(user) =
                                    User::from_id(&state_clone.app_data, &m.user_id).await
                                {
                                    SimpleMemberResponse {
                                        role: m.role,
                                        email: user.email,
                                    }
                                } else {
                                    SimpleMemberResponse {
                                        role: m.role,
                                        email: "Uknown".to_string(),
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
    } else {
        let error = ErrorResponse {
            error: "Unauthorized".to_string(),
        };
        Json(error).into_response()
    }
}

pub async fn get_workspaces(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Response {
    if let Some(user) = auth_user.user {
        match Workspace::get_user_workspaces(&state.app_data, &user).await {
            Ok(workspace_ids) => {
                let workspaces: Vec<Workspace> = join_all(
                    workspace_ids
                        .iter()
                        .map(|id| Workspace::from_id(&state.app_data, id)),
                )
                .await
                .into_iter()
                .filter_map(Result::ok)
                .collect();

                Json(workspaces).into_response()
            }
            Err(_) => {
                let error = ErrorResponse {
                    error: "Failed to fetch workspaces".to_string(),
                };
                Json(error).into_response()
            }
        }
    } else {
        let error = ErrorResponse {
            error: "Unauthorized".to_string(),
        };
        Json(error).into_response()
    }
}
