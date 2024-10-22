use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::core::{Connection, PostgisConfig, PostgresConnection, User, Workspace};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
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

// TODO: Check workspace role: only allow admin to create connection
pub async fn create_connection(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<CreateConnectionRequest>,
) -> Response {
    let connection_info = Connection::from_req(req, auth_user.user.unwrap());

    match connection_info.clone().create_record(&state.app_data).await {
        Ok(_) => {
            println!("Created connection record");
            let connections = state
                .app_data
                .clone()
                .get_workspace_connections(&connection_info.workspace_id)
                .await;
            println!("{:?}", connections);
            (StatusCode::OK, "connection creation submitted").into_response()
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "connection creation failed",
        )
            .into_response(),
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
        .get_member(&state.app_data, auth_user.user.unwrap())
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
