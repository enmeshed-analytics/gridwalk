use crate::app_state::AppState;
use crate::core::{CreateUser, Role, Roles, User};
use crate::data::Database;
use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use martin_tile_utils::TileCoord;
use serde::Deserialize;
use std::sync::Arc;

pub async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "healthy" }))
}

pub async fn tiles<D: Database>(
    Path((z, y, x)): Path<(u32, u32, u32)>,
    State(state): State<Arc<AppState<D>>>,
) -> Response {
    if let Some(tile_info_source) = state.sources.get("pois") {
        let xyz = TileCoord {
            x,
            y,
            z: z.try_into().unwrap(),
        };
        match tile_info_source.get_tile(xyz, None).await {
            Ok(tile_data) => (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, "application/vnd.mapbox-vector-tile"),
                    (header::ACCESS_CONTROL_ALLOW_ORIGIN, "*"),
                ],
                tile_data,
            )
                .into_response(),
            Err(_) => (StatusCode::NOT_FOUND, "Tile not found".to_string()).into_response(),
        }
    } else {
        (
            StatusCode::NOT_FOUND,
            "Tile info source not found".to_string(),
        )
            .into_response()
    }
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
