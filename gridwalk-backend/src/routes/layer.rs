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
    fs::{self, OpenOptions},
    io::AsyncWriteExt,
};

pub async fn upload_layer(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Extract chunk information
    let chunk_number = headers
        .get("x-chunk-number")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u32>().ok())
        .ok_or_else(|| {
            let error = json!({ "error": "Missing or invalid chunk number" });
            (StatusCode::BAD_REQUEST, Json(error))
        })?;

    let total_chunks = headers
        .get("x-total-chunks")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u32>().ok())
        .ok_or_else(|| {
            let error = json!({ "error": "Missing or invalid total chunks" });
            (StatusCode::BAD_REQUEST, Json(error))
        })?;

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

    let upload_id = format!("{}_upload", workspace_id);

    tracing::info!(
        "Processing request: chunk {}/{}, upload_id: {}",
        chunk_number,
        total_chunks,
        upload_id
    );

    // Process multipart form
    while let Some(mut field) = multipart.next_field().await.map_err(|e| {
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
                        let temp_path = dir_path.join(format!("temp_{upload_id}_{filename}"));
                        tracing::info!("Processing file at path: {}", temp_path.display());

                        let mut file = OpenOptions::new()
                            .create(true)
                            .append(true)
                            .open(&temp_path)
                            .await
                            .map_err(|e| {
                                tracing::error!(
                                    "Failed to open file: {}, error: {}",
                                    temp_path.display(),
                                    e
                                );
                                let error = json!({
                                    "error": "Failed to open temporary file",
                                    "details": e.to_string()
                                });
                                (StatusCode::INTERNAL_SERVER_ERROR, Json(error))
                            })?;

                        let mut chunk_bytes = 0usize;
                        while let Some(chunk) = field.chunk().await.map_err(|e| {
                            let error = json!({
                                "error": "Failed to read file chunk",
                                "details": e.to_string()
                            });
                            (StatusCode::BAD_REQUEST, Json(error))
                        })? {
                            chunk_bytes += chunk.len();
                            file.write_all(&chunk).await.map_err(|e| {
                                let error = json!({
                                    "error": "Failed to write chunk",
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

                        tracing::info!(
                            "Chunk {}/{} written: {} bytes",
                            chunk_number + 1,
                            total_chunks,
                            chunk_bytes
                        );

                        if chunk_number < total_chunks - 1 {
                            let upload_id = if chunk_number == 0 {
                                temp_path
                                    .file_name()
                                    .and_then(|n| n.to_str())
                                    .and_then(|n| n.split('_').nth(1))
                                    .unwrap_or("")
                            } else {
                                &upload_id
                            };

                            return Ok((
                                StatusCode::OK,
                                Json(json!({
                                    "status": "chunk_received",
                                    "chunk": chunk_number,
                                    "total": total_chunks,
                                    "upload_id": upload_id,
                                    "bytes_received": chunk_bytes
                                })),
                            ));
                        }

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

    // Get final path and layer info
    let final_path = file_path.ok_or_else(|| {
        let error = json!({
            "error": "No file was uploaded",
            "details": null
        });
        (StatusCode::BAD_REQUEST, Json(error))
    })?;

    // If this is not the final chunk, return progress
    if chunk_number < total_chunks - 1 {
        return Ok((
            StatusCode::OK,
            Json(json!({
                "status": "chunk_received",
                "chunk": chunk_number,
                "total": total_chunks,
                "upload_id": final_path.file_name().unwrap().to_string_lossy()
            })),
        ));
    }

    // Only process the complete file on the final chunk
    let layer_info = layer_info.ok_or_else(|| {
        let error = json!({
            "error": "No layer info provided",
            "details": null
        });
        (StatusCode::BAD_REQUEST, Json(error))
    })?;

    let layer = Layer::from_req(layer_info, user);

    match process_layer(&state, &layer, user, &final_path).await {
        Ok(json_response) => {
            // Cleanup file after successful processing
            if let Err(cleanup_err) = fs::remove_file(&final_path).await {
                tracing::error!(
                    "Failed to clean up file after successful upload: {}",
                    cleanup_err
                );
                // Continue with success response even if cleanup fails
            } else {
                tracing::info!(
                    "Successfully cleaned up temporary file: {}",
                    final_path.display()
                );
            }
            Ok((StatusCode::OK, Json(json_response)))
        }
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

    // Write the record to database
    layer.write_record(&state.app_data).await.map_err(|e| {
        let error = json!({
            "error": "Failed to write layer record to Database",
            "details": e.to_string()
        });
        (StatusCode::INTERNAL_SERVER_ERROR, Json(error))
    })?;

    // Return success response
    Ok(serde_json::to_value(layer).unwrap_or_else(|_| {
        json!({
            "status": "success",
            "message": "Layer created successfully"
        })
    }))
}
