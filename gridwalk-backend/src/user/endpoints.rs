use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::utils::verify_password;
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
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

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
    // Get user from app db, if Error, early return 401
    let user = match User::from_email(&state.app_data, &req.email).await {
        Ok(user) => user,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "UNAUTHORIZED" })),
            )
        }
    };

    if !user.active {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "UNAUTHORIZED" })),
        );
    }

    // Check creds
    match verify_password(&user.hash, &req.password) {
        Ok(password_verified) => {
            if !password_verified {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({ "error": "UNAUTHORIZED" })),
                );
            }
        },
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "UNAUTHORIZED" })),
            )
        }
    };

    // Create session
    match Session::create(&state.app_data, Some(&user)).await {
        Ok(session) => {
            let token = session.id.to_string();
            let response = json!({
                "apiKey": token,
            });
            (StatusCode::OK, Json(response))
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to create session" })),
        ),
    }
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    TypedHeader(authorization): TypedHeader<Authorization<Bearer>>,
) -> impl IntoResponse {
    let token = authorization.token();
    // Convert the token to a UUID
    let session_id = match Uuid::from_str(token) {
        Ok(id) => id,
        Err(_) => return (StatusCode::UNAUTHORIZED, "invalid token".to_string()).into_response(),
    };

    let session = match Session::from_id(&state.app_data, &session_id).await {
        Ok(session) => session,
        Err(_) => return (StatusCode::UNAUTHORIZED, "".to_string()).into_response(),
    };

    match session.delete(&state.app_data).await {
        Ok(_) => (StatusCode::OK, "logout succeeded".to_string()).into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "logout failed".to_string(),
        )
            .into_response(),
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
