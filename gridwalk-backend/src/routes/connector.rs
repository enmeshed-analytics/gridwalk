use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::core::{
    Connection, ConnectionAccess, GlobalRole, PostgisConfig, PostgresConnection, Workspace,
    WorkspaceMember,
};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
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

    // Attempt to create record
    match connection_info.create_record(&state.app_data).await {
        Ok(_) => (StatusCode::OK, "Connection creation submitted").into_response(),
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
            connector_type: con.access_config.path().to_string(),
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

            println!("Connection access list: {:?}", connection_access_list);

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

//pub async fn list_sources(
//    State(state): State<Arc<AppState>>,
//    Extension(auth_user): Extension<AuthUser>,
//    Path((workspace_id, connection_id)): Path<(String, String)>,
//) -> impl IntoResponse {
//    let workspace = Workspace::from_id(&state.app_data, &workspace_id)
//        .await
//        .unwrap();
//    let _member = workspace
//        .get_member(&state.app_data, &auth_user.user.unwrap())
//        .await
//        .unwrap();
//    // Check member role
//    let connection = Connection::from_id(&state.app_data, &workspace_id, &connection_id)
//        .await
//        .unwrap();
//
//    match state.geospatial_config.get_connection(&connection_id).await {
//        Ok(connector) => match connector.list_sources().await {
//            Ok(sources) => Json(sources).into_response(),
//            Err(e) => {
//                eprintln!("Error listing sources: {:?}", e);
//                (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list sources").into_response()
//            }
//        },
//        Err(_) => {
//            println!("Connection not found, adding new connection to state");
//            let pg_config = PostgisConfig::new(connection.config).unwrap();
//            state
//                .geospatial_config
//                .add_connection(connection_id.clone(), pg_config)
//                .await;
//
//            match state.geospatial_config.get_connection(&connection_id).await {
//                Ok(connector) => match connector.list_sources().await {
//                    Ok(sources) => Json(sources).into_response(),
//                    Err(e) => {
//                        eprintln!("Error listing sources: {:?}", e);
//                        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to list sources")
//                            .into_response()
//                    }
//                },
//                Err(e) => {
//                    eprintln!("Error getting connection after adding: {:?}", e);
//                    (
//                        StatusCode::INTERNAL_SERVER_ERROR,
//                        "Failed to get connection",
//                    )
//                        .into_response()
//                }
//            }
//        }
//    }
//}
