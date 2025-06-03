use crate::auth::AuthUser;
use crate::error::ApiError;
use crate::AppState;
use crate::{Profile, Session, User, UserPassword};
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
use tracing::{error, info};
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
) -> Result<StatusCode, ApiError> {
    // TODO: Check if the user already exists
    let mut tx = state.pool.begin().await.map_err(|e| {
        error!("Failed to begin transaction: {:?}", e);
        ApiError::InternalServerError
    })?;
    let user = User::new(req.email, req.first_name, req.last_name, None);

    user.save(&mut tx).await.map_err(|e| {
        error!("Failed to create user: {:?}", e);
        ApiError::InternalServerError
    })?;

    let user_password = UserPassword::new(user.id, req.password);
    user_password.save(&mut tx).await.map_err(|e| {
        error!("Failed to create user password: {:?}", e);
        ApiError::InternalServerError
    })?;

    tx.commit().await.map_err(|e| {
        error!("Failed to commit transaction: {:?}", e);
        ApiError::InternalServerError
    })?;

    Ok(StatusCode::CREATED)
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
pub struct SessionResponse {
    sid: String,
    expiry: String,
}

impl From<Session> for SessionResponse {
    fn from(session: Session) -> Self {
        Self {
            sid: session.id.to_string(),
            expiry: session.expiry.to_string(),
        }
    }
}

// Endpoint to login with username and password
pub async fn login(
    State(state): State<AppState>,
    params: Json<LoginRequest>,
) -> Result<impl IntoResponse, ApiError> {
    info!("Login request received for email: {}", params.email);

    // Check if the user exists in the database
    let user = User::from_email(&*state.pool, &params.email.clone())
        .await
        .map_err(|e| {
            error!("Failed to fetch user: {:?}", e);
            ApiError::InternalServerError
        })?;

    let user_password = UserPassword::from_user(&*state.pool, &user)
        .await
        .map_err(|e| {
            error!("Failed to fetch user password: {:?}", e);
            ApiError::InternalServerError
        })?;

    match user_password.validate_password(&params.password).await {
        Ok(true) => {
            info!("Password is valid");
        }
        Ok(false) => {
            error!("Invalid password");
            return Err(ApiError::Unauthorized);
        }
        Err(e) => {
            error!("Failed to validate password: {:?}", e);
            return Err(ApiError::InternalServerError);
        }
    }

    let expires_at = chrono::Utc::now() + chrono::Duration::days(90);
    let session = Session::create(&*state.pool, user.id, None, None, expires_at)
        .await
        .map_err(|e| {
            error!("Failed to create session: {:?}", e);
            ApiError::InternalServerError
        })?;
    let session = SessionResponse::from(session);
    return Ok((StatusCode::OK, Json(session)).into_response());
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
