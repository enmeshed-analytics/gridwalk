use crate::auth::AuthUser;
use crate::config::AppState;
use crate::error::ApiError;
use crate::settings::settings::RegistrationApprovalSettings;
use crate::user::GlobalRole;
use axum::extract::{Extension, State};
use axum::Json;
use reqwest::StatusCode;
use tracing::{error, info};

pub async fn get_registration_approval_settings(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<(StatusCode, Json<RegistrationApprovalSettings>), ApiError> {
    let user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    match user.global_role {
        Some(GlobalRole::Admin) => {
            // User is authorized, continue
        }
        _ => {
            error!("Access denied: user {} is not a super admin", user.id);
            return Err(ApiError::Unauthorized);
        }
    }

    let settings = RegistrationApprovalSettings::load(&state.pool)
        .await
        .map_err(|e| {
            error!("Failed to load registration approval settings: {:?}", e);
            ApiError::InternalServerError
        })?;

    info!(
        "Retrieved registration approval settings for admin user {}",
        user.id
    );
    Ok((StatusCode::OK, Json(settings)))
}

pub async fn update_registration_approval_settings(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(payload): Json<RegistrationApprovalSettings>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    let user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    match user.global_role {
        Some(GlobalRole::Admin) => {
            // User is authorized, continue
        }
        _ => {
            error!("Access denied: user {} is not a super admin", user.id);
            return Err(ApiError::Unauthorized);
        }
    }

    payload.save(&state.pool).await.map_err(|e| {
        error!("Failed to save registration approval settings: {:?}", e);
        ApiError::InternalServerError
    })?;

    info!(
        "Updated registration approval settings by admin user {}: {:?}",
        user.id, payload
    );
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({"message": "Settings updated successfully"})),
    ))
}
