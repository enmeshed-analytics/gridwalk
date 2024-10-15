use crate::auth::AuthUser;
use crate::core::{User, Workspace, WorkspaceRole};
use crate::{app_state::AppState, core::get_unix_timestamp};
use axum::{
    extract::{Extension, State},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ReqCreateWorkspace {
    name: String,
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

#[derive(Debug, Deserialize)]
pub struct ReqAddWorkspaceMember {
    workspace_id: String,
    user_id: String,
    role: WorkspaceRole,
}

pub async fn add_workspace_member(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqAddWorkspaceMember>,
) -> Response {
    if let Some(req_user) = auth_user.user {
        // TODO: sort out unwraps and response
        let wsp = Workspace::from_id(&state.app_data, &req.workspace_id)
            .await
            .unwrap();
        let user = User::from_id(&state.app_data, &req.user_id).await.unwrap();
        let _ = wsp
            .add_member(&state.app_data, &req_user, &user, req.role)
            .await;
    };
    "added workspace member".into_response()
}

pub async fn remove_workspace_member(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqAddWorkspaceMember>,
) -> Response {
    if let Some(req_user) = auth_user.user {
        // TODO: sort out unwraps and response
        let wsp = Workspace::from_id(&state.app_data, &req.workspace_id)
            .await
            .unwrap();
        let user = User::from_id(&state.app_data, &req.user_id).await.unwrap();
        let _ = wsp.remove_member(&state.app_data, &req_user, &user).await;
    };
    "removed workspace member".into_response()
}
