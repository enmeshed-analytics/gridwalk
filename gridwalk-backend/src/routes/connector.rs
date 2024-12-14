use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::core::{
    Connection, ConnectionAccess, GlobalRole, PostgisConnector, PostgresConnection, Workspace,
    WorkspaceMember,
};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

// TODO: Allow other connector types
#[derive(Debug, Deserialize)]
pub struct CreateGlobalConnectionRequest {
    name: String,
    display_name: String,
    config: PostgresConnection,
}

impl Connection {
    pub fn from_req(req: CreateGlobalConnectionRequest) -> Self {
        Connection {
            id: req.name,
            name: req.display_name,
            connector_type: "postgis".into(),
            config: req.config,
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
    let connection_info = Connection::from_req(req);

    // Check if connection already exists
    if state
        .app_data
        .get_connection(&connection_info.id)
        .await
        .is_ok()
    {
        return (StatusCode::CONFLICT, "Connection already exists").into_response();
    }

    // Create postgis connector
    let postgis_connector = PostgisConnector::new(connection_info.clone().config).unwrap();

    // Attempt to create record
    match connection_info.clone().create_record(&state.app_data).await {
        Ok(_) => {
            // Add connection to geo_connections
            state
                .geo_connections
                .add_connection(connection_info.id, postgis_connector)
                .await;
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
            id: con.connection_id.clone(),
            name: con.connection_id,
            connector_type: "postgis".into(),
        }
    }
}

pub async fn list_connections(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<String>,
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
    Path((workspace_id, connection_id)): Path<(String, String)>,
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
                .geo_connections
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
