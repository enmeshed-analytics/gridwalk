use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::core::{
    Connection, PostgisConfig, PostgresConnection, User, Workspace, WorkspaceMember,
};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

// TODO: Allow other connector types
#[derive(Debug, Deserialize)]
pub struct CreateConnectionRequest {
    workspace_id: String,
    name: String,
    config: PostgresConnection,
}

impl Connection {
    pub fn from_req(req: CreateConnectionRequest, user: User) -> Self {
        Connection {
            id: Uuid::new_v4().to_string(),
            workspace_id: req.workspace_id,
            name: req.name,
            created_by: user.id,
            connector_type: "postgis".into(),
            config: req.config,
        }
    }
}

pub async fn create_connection(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<CreateConnectionRequest>,
) -> impl IntoResponse {
    if let Some(user) = auth_user.user {
        let workspace = match Workspace::from_id(&state.app_data, &req.workspace_id).await {
            Ok(workspace) => workspace,
            Err(_) => return (StatusCode::NOT_FOUND, "".to_string()),
        };

        // Check if the requesting user is a member of the workspace
        let member = match WorkspaceMember::get(&state.app_data, &workspace, &user).await {
            Ok(member) => member,
            Err(_) => return (StatusCode::NOT_FOUND, "".to_string()),
        };

        // Only allow admins to create connections
        if !member.is_admin() {
            return (StatusCode::FORBIDDEN, "".to_string());
        }

        let connection_info = Connection::from_req(req, user);
        match connection_info.clone().create_record(&state.app_data).await {
            Ok(_) => {
                println!("Created connection record");
                let connections = state
                    .app_data
                    .clone()
                    .get_workspace_connections(&connection_info.workspace_id)
                    .await;
                println!("{:?}", connections);
                (StatusCode::OK, "connection creation submitted".to_string())
            }
            Err(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "connection creation failed".to_string(),
            ),
        }
    } else {
        (StatusCode::FORBIDDEN, "".to_string())
    }
}

pub async fn delete_connection(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((workspace_id, connection_id)): Path<(String, String)>,
) -> Response {
    if let Some(req_user) = auth_user.user {
        // Get the workspace
        let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
            Ok(ws) => ws,
            Err(_) => return "workspace not found".into_response(),
        };

        // Check permissions
        match WorkspaceMember::get(&state.app_data, &workspace, &req_user).await {
            Ok(mem) => {
                if !mem.is_admin() {
                    return "permission denied".into_response();
                };
            }
            Err(_) => return "member not found".into_response(),
        };

        let con = match Connection::from_id(&state.app_data, &workspace_id, &connection_id).await {
            Ok(c) => c,
            Err(_) => return "connection not found".into_response(),
        };

        match con.delete(&state.app_data).await {
            Ok(_) => "".into_response(),
            Err(_) => "delete failed".into_response(),
        }
    } else {
        "unauthorized".into_response()
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionResponse {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub created_by: String,
    pub connector_type: String,
}

impl From<Connection> for ConnectionResponse {
    fn from(con: Connection) -> Self {
        ConnectionResponse {
            id: con.id,
            workspace_id: con.workspace_id,
            name: con.name,
            created_by: con.created_by,
            connector_type: con.connector_type,
        }
    }
}

pub async fn list_connections(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<String>,
) -> impl IntoResponse {
    match auth_user.user {
        // TODO: Check permissions
        Some(user) => {
            let workspace = Workspace::from_id(&state.app_data, &workspace_id)
                .await
                .map_err(|_| (StatusCode::NOT_FOUND, "".to_string()))?;

            // Check if the requesting user is a member of the workspace
            WorkspaceMember::get(&state.app_data, &workspace, &user)
                .await
                .map_err(|_| (StatusCode::FORBIDDEN, "unauthorized".to_string()))?;

            let connections = Connection::get_all(&state.app_data, &workspace_id)
                .await
                .ok()
                .unwrap();

            // Convert Vec<Connection> to Vec<ConnectionResponse>
            // Removes the config from the response
            let connection_responses: Vec<ConnectionResponse> = connections
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
    let workspace = Workspace::from_id(&state.app_data, &workspace_id)
        .await
        .unwrap();
    let _member = workspace
        .get_member(&state.app_data, &auth_user.user.unwrap())
        .await
        .unwrap();
    // Check member role
    let connection = Connection::from_id(&state.app_data, &workspace_id, &connection_id)
        .await
        .unwrap();

    match state.geospatial_config.get_connection(&connection_id).await {
        Ok(connector) => match connector.list_sources().await {
            Ok(sources) => Json(sources).into_response(),
            Err(e) => {
                eprintln!("Error listing sources: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list sources").into_response()
            }
        },
        Err(_) => {
            println!("Connection not found, adding new connection to state");
            let pg_config = PostgisConfig::new(connection.config).unwrap();
            state
                .geospatial_config
                .add_connection(connection_id.clone(), pg_config)
                .await;

            match state.geospatial_config.get_connection(&connection_id).await {
                Ok(connector) => match connector.list_sources().await {
                    Ok(sources) => Json(sources).into_response(),
                    Err(e) => {
                        eprintln!("Error listing sources: {:?}", e);
                        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list sources")
                            .into_response()
                    }
                },
                Err(e) => {
                    eprintln!("Error getting connection after adding: {:?}", e);
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "Failed to get connection",
                    )
                        .into_response()
                }
            }
        }
    }
}
