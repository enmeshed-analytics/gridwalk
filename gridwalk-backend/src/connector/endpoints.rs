use super::{ConnectionDetails, Connector, PostgisConnector};
use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::connector::{ConnectionConfig, ConnectionTenancy};
use crate::GlobalRole;
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

// TODO: Allow other connector types
#[derive(Debug, Deserialize)]
pub struct CreateGlobalConnectionRequest {
    name: String,
    tenancy: ConnectionTenancy,
    config: ConnectionDetails,
}

impl ConnectionConfig {
    pub fn from_req(req: CreateGlobalConnectionRequest) -> Self {
        ConnectionConfig {
            id: Uuid::new_v4(),
            name: req.name,
            tenancy: req.tenancy,
            config: req.config,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            active: true,
        }
    }
}

pub async fn test_connection(
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<CreateGlobalConnectionRequest>,
) -> impl IntoResponse {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Check support level
    let global_role = match user.check_global_role().await {
        Some(level) => level,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Only allow user with Super global role to create connections
    if global_role != GlobalRole::Super {
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    // Create connection info
    let connection_config = ConnectionConfig::from_req(req);

    // Test connection
    match connection_config.config {
        ConnectionDetails::Postgis(config) => {
            let mut connector = PostgisConnector::new(config).unwrap();
            match connector.test_connection().await {
                Ok(_) => {
                    return (
                        StatusCode::OK,
                        Json(json!({
                            "status": "success",
                            "message": "Connection test successful"
                        })),
                    )
                        .into_response()
                }
                Err(e) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(json!({
                            "status": "error",
                            "message": format!("Connection test failed: {}", e)
                        })),
                    )
                        .into_response()
                }
            }
        }
    }
}

pub async fn create_connection(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<CreateGlobalConnectionRequest>,
) -> impl IntoResponse {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Check support level
    let global_role = match user.check_global_role().await {
        Some(level) => level,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Only allow user with Super global role to create connections
    if global_role != GlobalRole::Super {
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    // Create connection info
    let connection_config = ConnectionConfig::from_req(req);

    // Attempt to create record
    match connection_config.clone().create(&state.app_data).await {
        Ok(_) => {
            // Add connection to connections
            let _ = state.connections.load_connection(connection_config).await;
            (StatusCode::OK, "Connection creation submitted").into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Connection creation failed: {}", e),
        )
            .into_response(),
    }
}

pub async fn get_all_connections(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> impl IntoResponse {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Any global role is allowed to get connections
    match user.check_global_role().await {
        Some(level) => level,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Get all connections
    let connections = ConnectionConfig::get_all(&state.app_data).await;

    let connections = match connections {
        Ok(connections) => connections,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to get connections: {}", e),
            )
                .into_response()
        }
    };

    (StatusCode::OK, Json(connections)).into_response()
}

pub async fn get_connection(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(connection_id): Path<Uuid>,
) -> impl IntoResponse {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Any global role is allowed to get connections
    match user.check_global_role().await {
        Some(level) => level,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Get connection
    let connection = ConnectionConfig::from_id(&state.app_data, &connection_id).await;

    let connection = match connection {
        Ok(connection) => connection,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to get connection: {}", e),
            )
                .into_response()
        }
    };

    (StatusCode::OK, Json(connection)).into_response()
}
