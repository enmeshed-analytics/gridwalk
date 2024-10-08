use crate::app_state::AppState;
use crate::core::{create_id, verify_password, CreateUser, Profile, Role, Roles, Session, User};
use crate::data::Database;
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

pub async fn login<D: Database>(
    State(state): State<Arc<AppState<D>>>,
    Json(req): Json<LoginRequest>,
) -> impl IntoResponse {
    // Get user from app db
    let user_response = User::from_email(state.app_data.clone(), &req.email).await;
    // Check creds
    match user_response {
        Ok(user) => {
            let password_verified = verify_password(&user.hash, &req.password).unwrap();
            if !password_verified {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({
                        "error": "Authentication failed"
                    })),
                );
            }
            let session_id = create_id(30).await;
            match state
                .app_data
                .create_session(Some(&user), &session_id)
                .await
            {
                Ok(_) => {
                    // Return session token
                    let response = json!({
                        "apiKey": session_id,
                    });
                    return (StatusCode::OK, Json(response));
                }
                Err(_) => {
                    // Session creation failed
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({
                            "error": "Failed to create session"
                        })),
                    )
                }
            }
        }
        Err(_) => (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "User not found"
            })),
        ),
    }
}

pub async fn profile<D: Database>(
    State(state): State<Arc<AppState<D>>>,
    TypedHeader(authorization): TypedHeader<Authorization<Bearer>>,
) -> Result<Json<Profile>, (StatusCode, String)> {
    // Extract the token from the Authorization header
    let token = authorization.token();

    // Retrieve the session using the token
    let session = Session::from_id(state.app_data.clone(), token)
        .await
        .map_err(|e| (StatusCode::UNAUTHORIZED, format!("Invalid session: {}", e)))?;

    // Get the user_id from the session
    let user_id = session.user_id.ok_or((
        StatusCode::UNAUTHORIZED,
        "Session does not have a user_id".to_string(),
    ))?;

    // Retrieve the user using the user_id
    let user = User::from_id(state.app_data.clone(), &user_id)
        .await
        .map_err(|e| (StatusCode::NOT_FOUND, format!("User not found: {}", e)))?;

    // Return the user as JSON
    Ok(Json(Profile::from(user)))
}
