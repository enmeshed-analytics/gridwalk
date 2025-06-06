use super::{DataStoreConfig, DataStoreDetails, DataStoreTenancy};
use crate::auth::AuthUser;
use crate::connector::{Connector, PostgisConnector};
use crate::error::ApiError;
use crate::AppState;
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
use tracing::error;
use uuid::Uuid;

// TODO: Allow other connector types
#[derive(Debug, Deserialize)]
pub struct CreateDataStoreRequest {
    name: String,
    tenancy: DataStoreTenancy,
    config: DataStoreDetails,
}

impl DataStoreConfig {
    pub fn from_req(req: CreateDataStoreRequest) -> Self {
        Self {
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
    Json(req): Json<CreateDataStoreRequest>,
) -> impl IntoResponse {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Only allow user with Super global role to create connections
    match user.global_role {
        Some(GlobalRole::Admin) => {}
        Some(_) => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    // Create connection info
    let connection_config = DataStoreConfig::from_req(req);

    // Test connection
    match connection_config.config {
        DataStoreDetails::Postgis(config) => {
            let mut connector = PostgisConnector::new(config).unwrap();
            match connector.test_connection().await {
                Ok(_) => (
                    StatusCode::OK,
                    Json(json!({
                        "status": "success",
                        "message": "Connection test successful"
                    })),
                )
                    .into_response(),
                Err(e) => (
                    StatusCode::BAD_REQUEST,
                    Json(json!({
                        "status": "error",
                        "message": format!("Connection test failed: {}", e)
                    })),
                )
                    .into_response(),
            }
        }
    }
}

pub async fn create_datastore(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<CreateDataStoreRequest>,
) -> Result<StatusCode, ApiError> {
    let user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    // Check support level
    match user.global_role {
        Some(GlobalRole::Admin) => {}
        _ => return Err(ApiError::Unauthorized),
    }

    // Create connection info
    let connection_config = DataStoreConfig::from_req(req);

    // Test connection before creating it
    match &connection_config.config {
        DataStoreDetails::Postgis(config) => {
            let mut connector = PostgisConnector::new(config.clone()).unwrap();
            if let Err(e) = connector.test_connection().await {
                error!("Connection test failed: {}", e);
                return Err(ApiError::BadRequest(format!(
                    "Connection test failed: {}",
                    e
                )));
            }
        }
    }

    // Attempt to create record
    match connection_config.clone().save(&*state.pool).await {
        Ok(_) => {
            // Add connection to connections
            let _ = state.connections.load_connection(connection_config).await;
            Ok(StatusCode::CREATED)
        }
        Err(e) => {
            error!("Failed to create connection: {:?}", e);
            Err(ApiError::InternalServerError)
        }
    }
}

pub async fn get_all_datastores(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    match user.global_role {
        Some(_) => {} // Any global role is allowed to get connections
        _ => return Err(ApiError::Unauthorized),
    }

    let connections = DataStoreConfig::get_all(&*state.pool).await.map_err(|e| {
        error!("Failed to get connections: {:?}", e);
        ApiError::InternalServerError
    })?;
    Ok(Json(connections))
}

pub async fn get_datastore(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(connection_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    match user.global_role {
        Some(_) => {} // Any global role is allowed to get connections
        _ => return Err(ApiError::Unauthorized),
    }

    // Get connection
    let connection = DataStoreConfig::from_id(&*state.pool, &connection_id)
        .await
        .map_err(|e| {
            error!("Failed to get connection: {:?}", e);
            ApiError::InternalServerError
        })?;

    Ok(Json(connection))
}

pub async fn get_datastore_capacity(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(connection_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    match user.global_role {
        Some(_) => {} // Any global role is allowed to get connections
        _ => return Err(ApiError::Unauthorized),
    }

    // Get connection
    let connection = match DataStoreConfig::from_id(&*state.pool, &connection_id).await {
        Ok(connection) => connection,
        Err(e) => {
            error!("Failed to get connection: {:?}", e);
            return Err(ApiError::InternalServerError);
        }
    };

    let capacity_info = connection.capacity_info(&*state.pool).await.map_err(|e| {
        error!("Failed to get connection capacity info: {:?}", e);
        ApiError::InternalServerError
    })?;

    Ok(Json(json!({
        "connection_id": connection.id,
        "capacity": capacity_info.capacity,
        "usage": capacity_info.usage_count,
    })))
}
