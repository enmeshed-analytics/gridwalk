use crate::auth::AuthUser;
use crate::error::ApiError;
use crate::AppState;
use crate::{
    ConnectionConfig, User, Workspace, WorkspaceConnectionAccess, WorkspaceMember, WorkspaceRole,
};
use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use futures;
use futures::stream::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::error;
use uuid::Uuid;

#[derive(Serialize)]
pub struct ErrorResponse {
    error: String,
}

#[derive(Debug, Deserialize)]
pub struct ReqCreateWorkspace {
    name: String,
}

#[derive(Debug, Serialize)]
pub struct SimpleMemberResponse {
    role: WorkspaceRole,
    email: String,
}

impl Workspace {
    pub fn from_req(req: ReqCreateWorkspace) -> Self {
        Workspace {
            id: Uuid::new_v4(),
            name: req.name,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            active: true,
        }
    }
}

pub async fn create_workspace(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Json(req): Json<ReqCreateWorkspace>,
) -> Result<impl IntoResponse, ApiError> {
    let user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    // TODO: Limit workspace creation based on global limits per user

    // Find a connection with available capacity
    let connection_capacity_vec = ConnectionConfig::get_shared_with_spare_capacity(&state.pool)
        .await
        .map_err(|e| {
            error!("Failed to fetch connections: {:?}", e);
            ApiError::InternalServerError
        })?;

    // Get connection with the highest available capacity
    let selected_connection_capacity = connection_capacity_vec
        .iter()
        .max_by_key(|conn| conn.capacity - conn.usage_count)
        .ok_or_else(|| {
            error!("No available connections found");
            ApiError::InternalServerError
        })?;

    let workspace = Workspace::from_req(req);
    let owner = WorkspaceMember::new(&workspace, &user, WorkspaceRole::Owner);
    let connection_access =
        WorkspaceConnectionAccess::new(selected_connection_capacity.connection_id, workspace.id);

    let mut tx = state.pool.begin().await.map_err(|e| {
        error!("Failed to begin transaction: {:?}", e);
        ApiError::InternalServerError
    })?;

    workspace.save(&mut *tx).await.map_err(|e| {
        error!("Failed to create workspace: {:?}", e);
        ApiError::InternalServerError
    })?;
    owner.save(&mut *tx).await.map_err(|e| {
        error!("Failed to add workspace member: {:?}", e);
        ApiError::InternalServerError
    })?;
    connection_access.save(&mut *tx).await;

    match tx.commit().await {
        Ok(_) => Ok(StatusCode::CREATED),
        Err(e) => {
            error!("Failed to commit transaction: {:?}", e);
            return Err(ApiError::InternalServerError);
        }
    }
}

// TODO: fix the implementation. Removed as it leaves dangling references and data
pub async fn delete_workspace(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let _user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    // Retrieve the workspace
    let _workspace = match Workspace::from_id(&*state.pool, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return Err(ApiError::Unauthorized),
    };

    Ok(StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Debug, Deserialize)]
pub struct ReqAddWorkspaceMember {
    email: String,
    role: WorkspaceRole,
}

pub async fn add_workspace_member(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
    Json(req): Json<ReqAddWorkspaceMember>,
) -> Result<impl IntoResponse, ApiError> {
    let requesting_user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    // Get the workspace
    let workspace = match Workspace::from_id(&*state.pool, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return Err(ApiError::NotFound("Workspace not found".to_string())),
    };

    match WorkspaceMember::get(&*state.pool, &workspace, &requesting_user).await {
        Ok(member) if matches!(member.role, WorkspaceRole::Owner | WorkspaceRole::Admin) => {}
        _ => return Err(ApiError::Unauthorized),
    }

    // Get the target user by email
    let user_to_add = match User::from_email(&*state.pool, &req.email).await {
        Ok(user) => user,
        Err(_) => return Err(ApiError::NotFound("User not found".to_string())),
    };

    // Check if the user is already a member of the workspace
    let existing_member_check = WorkspaceMember::get(&*state.pool, &workspace, &user_to_add).await;
    if existing_member_check.is_ok() {
        return Ok(StatusCode::CONFLICT);
    }

    // Add the user to the workspace
    let new_member = WorkspaceMember::new(&workspace, &user_to_add, req.role);
    match new_member.save(&*state.pool).await {
        Ok(_) => Ok(StatusCode::CREATED),
        Err(e) => {
            error!("Failed to add workspace member: {:?}", e);
            Err(ApiError::InternalServerError)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ReqRemoveWorkspaceMember {
    workspace_id: Uuid,
    email: String,
}

pub async fn remove_workspace_member(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
    Json(req): Json<ReqRemoveWorkspaceMember>,
) -> Result<impl IntoResponse, ApiError> {
    let requesting_user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    // Get the workspace
    let workspace = match Workspace::from_id(&*state.pool, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return Err(ApiError::NotFound("Workspace not found".to_string())),
    };

    // Check if the requesting user is a member of the workspace
    match WorkspaceMember::get(&*state.pool, &workspace, &requesting_user).await {
        Ok(member) if matches!(member.role, WorkspaceRole::Owner | WorkspaceRole::Admin) => {}
        _ => return Err(ApiError::Unauthorized),
    }

    // Get the target user by email
    let user_to_remove = match User::from_email(&*state.pool, &req.email).await {
        Ok(user) => user,
        Err(_) => return Err(ApiError::NotFound("User not found".to_string())),
    };

    let member_to_remove =
        match WorkspaceMember::get(&*state.pool, &workspace, &user_to_remove).await {
            Ok(member) => member,
            Err(_) => {
                return Err(ApiError::NotFound(
                    "Member not found in workspace".to_string(),
                ))
            }
        };

    match member_to_remove.delete(&*state.pool).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(e) => {
            error!("Failed to remove workspace member: {:?}", e);
            Err(ApiError::InternalServerError)
        }
    }
}

pub async fn get_workspace_members(
    State(state): State<Arc<AppState>>,
    Extension(auth): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let requesting_user = auth.user.ok_or_else(|| {
        error!("Unauthorized access: no valid user found in middleware");
        ApiError::Unauthorized
    })?;

    // Get the workspace
    let workspace = match Workspace::from_id(&*state.pool, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => return Err(ApiError::NotFound("Workspace not found".to_string())),
    };

    // Check if the requesting user is a member of the workspace
    match WorkspaceMember::get(&*state.pool, &workspace, &requesting_user).await {
        Ok(_member) => {}
        _ => return Err(ApiError::Unauthorized),
    }

    // Get all members of the workspace
    workspace
        .get_members(&*state.pool)
        .await
        .map_err(|e| {
            error!("Failed to fetch workspace members: {:?}", e);
            ApiError::InternalServerError
        })
        .map(|members| {
            let response: Vec<SimpleMemberResponse> = members
                .into_iter()
                .map(|member| SimpleMemberResponse {
                    role: member.role,
                    email: member.user.email.clone(),
                })
                .collect();
            Json(response).into_response()
        })
}

pub async fn get_workspaces(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
) -> Response {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    match Workspace::get_user_workspaces(&state.app_data, &user).await {
        Ok(workspaces) => Json(workspaces).into_response(),
        Err(_) => {
            let error = ErrorResponse {
                error: "Failed to fetch workspaces".to_string(),
            };
            Json(error).into_response()
        }
    }
}

pub async fn get_workspace(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Response {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(workspace) => {
            if let Ok(_member) = workspace.get_member(&state.app_data, &user).await {
                Json(workspace).into_response()
            } else {
                let error = ErrorResponse {
                    error: "Unauthorized".to_string(),
                };
                Json(error).into_response()
            }
        }
        Err(_) => {
            let error = ErrorResponse {
                error: "Workspace not found".to_string(),
            };
            Json(error).into_response()
        }
    }
}

// For a workspace with a given connection_id, list all data sources
// e.g. tables, views, etc.
pub async fn list_sources(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path((workspace_id, connection_id)): Path<(Uuid, Uuid)>,
) -> impl IntoResponse {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized").into_response(),
    };

    let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => {
            return (StatusCode::NOT_FOUND, "Workspace not found".to_string()).into_response()
        }
    };

    match WorkspaceMember::get(&state.app_data, &workspace, &user).await {
        Ok(_member) => {}
        Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    }

    match WorkspaceConnectionAccess::get(&state.app_data, &workspace, &connection_id).await {
        Ok(_access) => {}
        Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    }

    let connection = state.connections.get_connection(&connection_id).unwrap();

    match connection.list_sources(&workspace.id).await {
        Ok(sources) => Json(sources).into_response(),
        Err(e) => {
            eprintln!("Error listing sources: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to list sources".to_string(),
            )
                .into_response()
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionResponse {
    pub id: String,
    pub name: String,
    pub connector_type: String,
    pub tenancy: String,
}

// TODO: Switch to using Connection after retrieving the connection from the database
impl From<ConnectionConfig> for ConnectionResponse {
    fn from(con: ConnectionConfig) -> Self {
        ConnectionResponse {
            id: con.id.to_string(),
            name: con.name,
            connector_type: con.config.to_string(),
            tenancy: con.tenancy.to_string(),
        }
    }
}

// List all accessible connections for a given workspace
pub async fn list_connections(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> impl IntoResponse {
    let user = match auth_user.user {
        Some(user) => user,
        None => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    };

    let workspace = match Workspace::from_id(&state.app_data, &workspace_id).await {
        Ok(ws) => ws,
        Err(_) => {
            return (StatusCode::NOT_FOUND, "Workspace not found".to_string()).into_response()
        }
    };

    // Check if the requesting user is a member of the workspace
    match WorkspaceMember::get(&state.app_data, &workspace, &user).await {
        Ok(_member) => {}
        Err(_) => return (StatusCode::FORBIDDEN, "Unauthorized".to_string()).into_response(),
    }

    let connection_access_list = WorkspaceConnectionAccess::get_all(&state.app_data, &workspace)
        .await
        .ok()
        .unwrap();

    // Convert Vec<Connection> to Vec<ConnectionResponse>
    // Removes the config from the response
    let connection_responses: Vec<ConnectionResponse> = connection_access_list
        .into_iter()
        .map(ConnectionResponse::from)
        .collect();

    Json(connection_responses).into_response()
}
