use super::ConnectionDetails;
use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::connector::{ConnectionAccess, ConnectionConfig, ConnectionTenancy};
use crate::{GlobalRole, Workspace, WorkspaceMember};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
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

    // Check if connection already exists
    if state
        .app_data
        .get_connection(&connection_config.id)
        .await
        .is_ok()
    {
        return (StatusCode::CONFLICT, "Connection already exists").into_response();
    }

    // Attempt to create record
    match connection_config
        .clone()
        .create_record(&state.app_data)
        .await
    {
        Ok(_) => {
            // Add connection to connections
            state.connections.add_connection(connection_config).await;
            (StatusCode::OK, "Connection creation submitted").into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Connection creation failed: {}", e),
        )
            .into_response(),
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionResponse {
    pub id: String,
    pub name: String,
    pub connector_type: String,
}

// TODO: Switch to using Connection after retrieving the connection from the database
impl From<ConnectionAccess> for ConnectionResponse {
    fn from(con: ConnectionAccess) -> Self {
        ConnectionResponse {
            id: con.connection_id.clone().to_string(),
            name: con.connection_id.clone().to_string(),
            connector_type: "postgis".into(), // TODO: Fix this
        }
    }
}

pub async fn list_connections(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> impl IntoResponse {
    match auth_user.user {
        Some(user) => {
            let workspace = Workspace::from_id(&state.app_data, &workspace_id)
                .await
                .map_err(|_| (StatusCode::NOT_FOUND, "".to_string()))?;

            // Check if the requesting user is a member of the workspace
            WorkspaceMember::get(&state.app_data, &workspace, &user)
                .await
                .map_err(|_| (StatusCode::FORBIDDEN, "unauthorized".to_string()))?;

            let connection_access_list = ConnectionAccess::get_all(&state.app_data, &workspace)
                .await
                .ok()
                .unwrap();

            // Convert Vec<Connection> to Vec<ConnectionResponse>
            // Removes the config from the response
            let connection_responses: Vec<ConnectionResponse> = connection_access_list
                .into_iter()
                .map(ConnectionResponse::from)
                .collect();

            Ok(Json(connection_responses))
        }
        None => Err((StatusCode::FORBIDDEN, "unauthorized".to_string())),
    }
}

pub async fn list_sources(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((workspace_id, connection_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    match auth_user.user {
        Some(user) => {
            let workspace = Workspace::from_id(&state.app_data, &workspace_id)
                .await
                .map_err(|_| (StatusCode::NOT_FOUND, "".to_string()))?;

            // Check if the requesting user is a member of the workspace
            WorkspaceMember::get(&state.app_data, &workspace, &user)
                .await
                .map_err(|_| (StatusCode::FORBIDDEN, "unauthorized".to_string()))?;

            // TODO: Check Access Level
            let _connection_access =
                ConnectionAccess::get(&state.app_data, &workspace, &connection_id)
                    .await
                    .map_err(|_| (StatusCode::NOT_FOUND, "".to_string()))?;

            let connection = state
                .connections
                .get_connection(&connection_id)
                .await
                .unwrap();

            match connection.list_sources(&workspace.id).await {
                Ok(sources) => Ok(Json(sources)),
                Err(e) => {
                    eprintln!("Error listing sources: {:?}", e);
                    Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "Failed to list sources".to_string(),
                    ))
                }
            }
        }
        None => Err((StatusCode::FORBIDDEN, "unauthorized".to_string())),
    }
}
