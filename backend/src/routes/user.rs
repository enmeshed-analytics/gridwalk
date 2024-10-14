use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::core::{create_id, verify_password, CreateUser, Profile, Session, User};
use crate::data::Database;
use axum::{
    extract::{Extension, State},
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
                    (StatusCode::OK, Json(response))
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

pub async fn logout<D: Database>(
    State(state): State<Arc<AppState<D>>>,
    TypedHeader(authorization): TypedHeader<Authorization<Bearer>>,
) -> impl IntoResponse {
    let token = authorization.token();
    match Session::from_id(state.app_data.clone(), token).await {
        Ok(session) => {
            let _ = session.delete(state.app_data.clone()).await;
            "logged out".into_response()
        }
        Err(_) => "logged out".into_response(),
    }
}

pub async fn profile(
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Profile>, (StatusCode, String)> {
    match auth_user.user {
        Some(user) => Ok(Json(Profile::from(user))),
        None => Err((StatusCode::FORBIDDEN, "unauthorized".to_string())),
    }
}
