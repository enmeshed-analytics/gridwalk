use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::core::{CreateLayer, Layer, User, Workspace, WorkspaceRole};
use axum::{
    extract::{Extension, Multipart, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde_json::json;
use std::path::Path;
use std::sync::Arc;
use tokio::{
    fs::{self, File},
    io::AsyncWriteExt,
};

pub async fn upload_layer(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Extract headers
    let file_type = headers
        .get("x-file-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let workspace_id = headers
        .get("x-workspace-id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            let error = json!({
                "error": "Missing workspace ID in headers",
                "details": null
            });
            (StatusCode::BAD_REQUEST, Json(error))
        })?;

    tracing::info!(
        "Processing upload for file type: {} workspace: {}",
        file_type,
        workspace_id
    );

    let user = auth_user.user.as_ref().ok_or_else(|| {
        let error = json!({
            "error": "Unauthorized request",
            "details": null
        });
        (StatusCode::UNAUTHORIZED, Json(error))
    })?;

    let mut layer_info: Option<CreateLayer> = None;
    let mut file_path = None;

    // Create uploads directory
    let dir_path = Path::new("uploads");
    fs::create_dir_all(dir_path).await.map_err(|e| {
        let error = json!({
            "error": "Failed to create uploads directory",
            "details": e.to_string()
        });
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error))
    })?;

    // Process multipart form
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        let error = json!({
            "error": "Failed to process form field",
            "details": e.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(error))
    })? {
        if let Some(name) = field.name() {
            tracing::info!("Processing field: {}", name);

            match name {
                "file" => {
                    if let Some(filename) = field.file_name() {
                        tracing::info!("Processing file: {}", filename);

                        let temp_path =
                            dir_path.join(format!("temp_{}_{}", uuid::Uuid::new_v4(), filename));

                        let mut file = File::create(&temp_path).await.map_err(|e| {
                            let error = json!({
                                "error": "Failed to create temporary file",
                                "details": e.to_string()
                            });
                            (StatusCode::INTERNAL_SERVER_ERROR, Json(error))
                        })?;

                        let mut total_bytes = 0usize;

                        // Stream the file
                        let mut field = field;
                        while let Some(chunk) = field.chunk().await.map_err(|e| {
                            let error = json!({
                                "error": "Failed to read file chunk",
                                "details": e.to_string()
                            });
                            (StatusCode::BAD_REQUEST, Json(error))
                        })? {
                            total_bytes += chunk.len();
                            file.write_all(&chunk).await.map_err(|e| {
                                let error = json!({
                                    "error": "Failed to write file chunk",
                                    "details": e.to_string()
                                });
                                (StatusCode::INTERNAL_SERVER_ERROR, Json(error))
                            })?;
                        }

                        file.sync_all().await.map_err(|e| {
                            let error = json!({
                                "error": "Failed to sync file to disk",
                                "details": e.to_string()
                            });
                            (StatusCode::INTERNAL_SERVER_ERROR, Json(error))
                        })?;

                        tracing::info!("File upload complete: {} bytes", total_bytes);
                        file_path = Some(temp_path);
                    }
                }
                "layer_info" => {
                    let bytes = field.bytes().await.map_err(|e| {
                        let error = json!({
                            "error": "Failed to read layer info",
                            "details": e.to_string()
                        });
                        (StatusCode::BAD_REQUEST, Json(error))
                    })?;

                    let info_str = String::from_utf8(bytes.to_vec()).map_err(|e| {
                        let error = json!({
                            "error": "Invalid UTF-8 in layer info",
                            "details": e.to_string()
                        });
                        (StatusCode::BAD_REQUEST, Json(error))
                    })?;

                    tracing::debug!("Received layer info: {}", info_str);

                    layer_info = Some(serde_json::from_str(&info_str).map_err(|e| {
                        let error = json!({
                            "error": "Invalid layer info JSON",
                            "details": e.to_string()
                        });
                        (StatusCode::BAD_REQUEST, Json(error))
                    })?);
                }
                _ => {
                    tracing::warn!("Unexpected field: {}", name);
                }
            }
        }
    }

    // Validate required data
    let final_path = file_path.ok_or_else(|| {
        let error = json!({
            "error": "No file was uploaded",
            "details": null
        });
        (StatusCode::BAD_REQUEST, Json(error))
    })?;

    let layer_info = layer_info.ok_or_else(|| {
        let error = json!({
            "error": "No layer info provided",
            "details": null
        });
        (StatusCode::BAD_REQUEST, Json(error))
    })?;

    // Create and process layer
    let layer = Layer::from_req(layer_info, user);

    // Handle the rest of the process with proper error responses
    match process_layer(&state, &layer, user, &final_path).await {
        Ok(json_response) => Ok((StatusCode::OK, Json(json_response))),
        Err(e) => {
            if let Err(cleanup_err) = fs::remove_file(&final_path).await {
                tracing::error!("Failed to clean up file after error: {}", cleanup_err);
            }
            Err(e)
        }
    }
}

async fn process_layer(
    state: &Arc<AppState>,
    layer: &Layer,
    user: &User,
    file_path: &Path,
) -> Result<serde_json::Value, (StatusCode, Json<serde_json::Value>)> {
    // Validate workspace access
    let workspace = Workspace::from_id(&state.app_data, &layer.workspace_id)
        .await
        .map_err(|e| {
            let error = json!({
                "error": "Workspace not found",
                "details": e.to_string()
            });
            (StatusCode::NOT_FOUND, Json(error))
        })?;

    let member = workspace
        .get_member(&state.app_data, user)
        .await
        .map_err(|e| {
            let error = json!({
                "error": "Access forbidden",
                "details": e.to_string()
            });
            (StatusCode::FORBIDDEN, Json(error))
        })?;

    if member.role == WorkspaceRole::Read {
        let error = json!({
            "error": "Read-only access",
            "details": "User does not have write permission"
        });
        return Err((StatusCode::FORBIDDEN, Json(error)));
    }

    // Create layer in database
    layer
        .create(&state.app_data, user, &workspace)
        .await
        .map_err(|e| {
            let error = json!({
                "error": "Failed to create layer",
                "details": e.to_string()
            });
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error))
        })?;

    // Process the file
    layer
        .send_to_postgis(file_path.to_str().unwrap())
        .await
        .map_err(|e| {
            let error = json!({
                "error": "Failed to process file",
                "details": e.to_string()
            });
            (StatusCode::INTERNAL_SERVER_ERROR, Json(error))
        })?;

    // Write the record
    if let Err(e) = layer.write_record(&state.app_data).await {
        tracing::error!("Failed to write layer record: {}", e);
    }

    // Return success response
    Ok(serde_json::to_value(layer).unwrap_or_else(|_| {
        json!({
            "status": "success",
            "message": "Layer created successfully"
        })
    }))
}
