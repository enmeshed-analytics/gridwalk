use super::UserStatus;
use crate::error::ApiError;
use crate::AppState;
use crate::{RegistrationApprovalSettings, User, UserPassword};
use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use tracing::debug;
use tracing::{error, info};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    email: String,
    password: String,
    first_name: String,
    last_name: String,
}

use axum::debug_handler;

#[debug_handler]
pub async fn register(
    State(state): State<AppState>,
    Json(params): Json<RegisterRequest>,
) -> Result<StatusCode, ApiError> {
    info!("Registering new user: {}", params.email);

    // Check if the user already exists
    // TODO: Do not acknowledge the existence of the user for security reasons
    let existing_user = User::from_email(&*state.pool, &params.email).await;
    if existing_user.is_ok() {
        return Err(ApiError::BadRequest(
            "A user with this email already exists".to_string(),
        ));
    }

    let mut tx = state.pool.begin().await.map_err(|e| {
        error!("Failed to begin transaction: {:?}", e);
        ApiError::InternalServerError
    })?;

    // Load registration approval settings
    let approval_settings = RegistrationApprovalSettings::load(&*state.pool)
        .await
        .map_err(|e| {
            error!("Failed to load approval settings: {:?}", e);
            ApiError::InternalServerError
        })?;

    // Determine user status based on approval settings
    let user_status = if approval_settings.require_approval {
        UserStatus::PendingApproval
    } else {
        UserStatus::ActivePendingVerification
    };

    // Create a new user
    let user = User::new(
        params.email,
        Some(params.first_name),
        Some(params.last_name),
        None,
        user_status.clone(),
        None,
    );
    user.save(&mut *tx).await.map_err(|e| {
        error!("Failed to create user: {:?}", e);
        ApiError::InternalServerError
    })?;

    let user_password = UserPassword::new(user.id, params.password);
    user_password.save(&mut *tx).await.map_err(|e| {
        error!("Failed to create user password: {:?}", e);
        ApiError::InternalServerError
    })?;

    tx.commit().await.map_err(|e| {
        error!("Failed to commit transaction: {:?}", e);
        ApiError::InternalServerError
    })?;

    // Send appropriate email based on user status
    let user_name = format!(
        "{} {}",
        user.first_name.as_deref().unwrap_or(""),
        user.last_name.as_deref().unwrap_or("")
    )
    .trim()
    .to_string();

    match user_status {
        UserStatus::ActivePendingVerification => {
            // Send verification email
            // Create and save verification code
            let verification_code =
                user.add_verification_code(&*state.pool)
                    .await
                    .map_err(|e| {
                        error!("Failed to create verification code: {:?}", e);
                        ApiError::InternalServerError
                    })?;

            let verification_url = {
                let email_service = state.email_service.lock().await;
                email_service.generate_verification_url(&verification_code.id.to_string())
            };

            // Send verification email
            {
                let email_service_guard = state.email_service.lock().await;
                if let Err(e) = email_service_guard
                    .send_verification_email(&user.email, &user_name, &verification_url)
                    .await
                {
                    error!(
                        "Failed to send verification email to {}: {:?}",
                        user.email, e
                    );
                    // Note: We don't return an error here as the user was created successfully
                    // The email sending failure shouldn't prevent registration completion
                } else {
                    info!("Verification email sent successfully to {}", user.email);
                }
            }
        }
        UserStatus::PendingApproval => {
            // Send pending approval email to the registrant
            let email_service_guard = state.email_service.lock().await;
            if let Err(e) = email_service_guard
                .send_pending_approval_email(&user.email, &user_name, vec![user.email.clone()])
                .await
            {
                error!(
                    "Failed to send pending approval email to {}: {:?}",
                    user.email, e
                );
                // Note: We don't return an error here as the user was created successfully
                // The email sending failure shouldn't prevent registration completion
            } else {
                info!("Pending approval email sent successfully to {}", user.email);
            }
        }
        _ => {
            // For other statuses, no email is sent
            debug!("No email sent for user status: {:?}", user_status);
        }
    }

    Ok(StatusCode::CREATED)
}
