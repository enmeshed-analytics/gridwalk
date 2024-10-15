use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::core::{ConnectionInfo, User};
use crate::data::Database;
use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateConnectionRequest {
    workspace_id: String,
    name: String,
    postgis_uri: String,
}

impl ConnectionInfo {
    pub fn from_req(req: CreateConnectionRequest, user: User) -> Self {
        ConnectionInfo {
            id: Uuid::new_v4().to_string(),
            workspace_id: req.workspace_id,
            name: req.name,
            created_by: user.id,
            postgis_uri: req.postgis_uri,
        }
    }
}

pub async fn create_connection<D: Database>(
    State(state): State<Arc<AppState<D>>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<CreateConnectionRequest>,
) -> Response {
    let connection_info = ConnectionInfo::from_req(req, auth_user.user.unwrap());

    match connection_info.create_record(state.app_data.clone()).await {
        Ok(_) => (StatusCode::OK, "connection creation submitted").into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "connection creation failed",
        )
            .into_response(),
    }
}
