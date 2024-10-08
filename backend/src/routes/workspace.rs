use crate::app_state::AppState;
use crate::data::Database;
use axum::{
    extract::State,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct CreateWorkspace {
    name: String,
    owner: String,
    created_at: u64,
}

pub async fn create_workspace<D: Database>(
    State(state): State<Arc<AppState<D>>>,
    Json(req): Json<CreateWorkspace>,
) -> Response {
    "".into_response()
}
