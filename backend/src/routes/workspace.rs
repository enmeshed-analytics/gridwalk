use crate::auth::AuthUser;
use crate::core::Workspace;
use crate::data::Database;
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

pub async fn create_workspace<D: Database>(
    State(state): State<Arc<AppState<D>>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ReqCreateWorkspace>,
) -> Response {
    if let Some(owner) = auth_user.user {
        println!("{owner:?}");
        let wsp = Workspace::from_req(req, owner.id);
        let _ = Workspace::create(state.app_data.clone(), &wsp).await;
    };
    "workspace created".into_response()
}
