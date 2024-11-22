use crate::auth::AuthUser;
use crate::core::{User, Workspace, WorkspaceRole};
use crate::{app_state::AppState, core::get_unix_timestamp};
use axum::{
    extract::{Extension, State},
    response::{IntoResponse, Response},
    Json,
};
use futures;
use futures::future::join_all;
use serde::{Deserialize, Serialize};
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

pub async fn create_workspace(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqCreateWorkspace>,
) -> Response {
    if let Some(owner) = auth_user.user {
        println!("{owner:?}");
        let wsp = Workspace::from_req(req, owner.clone().id);
        match Workspace::create(&state.app_data, &wsp).await {
            Ok(_) => {
                let now = get_unix_timestamp();
                // TODO: Handle response from adding member
                let _ = state
                    .app_data
                    .add_workspace_member(&wsp, &owner, WorkspaceRole::Admin, now)
                    .await;
                "workspace created".into_response()
            }
            Err(_) => "workspace not created".into_response(),
        }
    } else {
        "workspace not created".into_response()
    }
}

pub async fn add_workspace_member(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqAddWorkspaceMember>, // Using your existing struct
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

        // Attempt to add member (role is already parsed since you use WorkspaceRole in ReqAddWorkspaceMember)
        match workspace
            .add_member(&state.app_data, &req_user, &user_to_add, req.role)
            .await
        {
            Ok(_) => "member added".into_response(),
            Err(_) => "failed to add member".into_response(),
        }
    } else {
        "unauthorized".into_response()
    }
}

pub async fn remove_workspace_member(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqAddWorkspaceMember>,
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

        match wsp.remove_member(&state.app_data, &req_user, &user).await {
            Ok(_) => "removed workspace member".into_response(),
            Err(_) => "failed to remove member".into_response(),
        }
    } else {
        "unauthorized".into_response()
    }
}

pub async fn get_workspaces(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Response {
    if let Some(user) = auth_user.user {
        println!("Fetching workspaces for user: {:?}", user.id);
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
            Err(e) => {
                println!("Error fetching workspaces: {:?}", e);
                let error = ErrorResponse {
                    error: "Failed to fetch workspaces".to_string(),
                };
                Json(error).into_response()
            }
        }
    } else {
        println!("No authenticated user found");
        let error = ErrorResponse {
            error: "Unauthorized".to_string(),
        };
        Json(error).into_response()
    }
}
