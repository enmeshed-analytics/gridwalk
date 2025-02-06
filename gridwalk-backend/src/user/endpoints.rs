use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::utils::{create_id, verify_password};
use crate::{CreateUser, Profile, Session, User};
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

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> Response {
    let user = CreateUser {
        email: req.email,
        first_name: req.first_name,
        last_name: req.last_name,
        global_role: None,
        password: req.password,
    };
    match User::create(&state.app_data, &user).await {
        Ok(_) => "registration succeeded".into_response(),
        Err(_) => "registration failed".into_response(),
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> impl IntoResponse {
    // Get user from app db
    let user_response = User::from_email(&state.app_data, &req.email).await;
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

pub async fn logout(
    State(state): State<Arc<AppState>>,
    TypedHeader(authorization): TypedHeader<Authorization<Bearer>>,
) -> impl IntoResponse {
    let token = authorization.token();
    match Session::from_id(&state.app_data, token).await {
        Ok(session) => {
            let _ = session.delete(&state.app_data).await;
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

#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequest {
    email: String,
    new_password: String,
}

pub async fn reset_password(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<ResetPasswordRequest>,
) -> impl IntoResponse {
    // Ensure user is authenticated
    let user = match auth_user.user {
        Some(user) => user,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "error": "Authentication required"
                })),
            )
        }
    };

    // Only allow users to reset their own password
    if user.email != req.email {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "Can only reset your own password"
            })),
        );
    }

    // Use the static method to handle the update
    match User::reset_password(&state.app_data, &req.email, &req.new_password).await {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({
                "message": "Password updated successfully"
            })),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "error": "Failed to update password"
            })),
        ),
    }
}
