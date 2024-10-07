use crate::app_state::AppState;
use crate::core::{CreateUser, Role, Roles, User};
use crate::data::Database;
use axum::{
    extract::State,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "healthy" }))
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    email: String,
    password: String,
    first_name: String,
    last_name: String,
}

pub async fn register<D: Database>(
    State(state): State<Arc<AppState<D>>>,
    Json(req): Json<RegisterRequest>,
) -> Response {
    let user = CreateUser {
        email: req.email,
        first_name: req.first_name,
        last_name: req.last_name,
        roles: Roles(vec![Role::TeamRead]), // TODO: Important! role for which org/team?
        password: req.password,
    };
    match User::create(state.app_data.clone(), &user).await {
        Ok(_) => "registration succeeded".into_response(),
        Err(_) => "registration failed".into_response(),
    }
}
