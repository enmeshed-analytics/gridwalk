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
    // Ensure that the user has auth to upload layer
    let user = auth_user.user.as_ref().ok_or_else(|| {
        let error = json!({
            "error": "Unauthorized request",
            "details": null
        });
        (StatusCode::UNAUTHORIZED, Json(error))
    })?;

    // Extract chunk information sent from the frontend
    // Total chunks to be processed
    let total_chunks = headers
        .get("x-total-chunks")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u32>().ok())
        .ok_or_else(|| {
            let error = json!({ "error": "Missing or invalid total chunks" });
            (StatusCode::BAD_REQUEST, Json(error))
        })?;

    // The current chunk number in the stream
    let chunk_number = headers
        .get("x-chunk-number")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u32>().ok())
        .ok_or_else(|| {
            let error = json!({ "error": "Missing or invalid chunk number" });
            (StatusCode::BAD_REQUEST, Json(error))
        })?;

    // Get workspace id from frontend
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

    // Create layer info (layer name and workspace id holder) + holder for final file path
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

    // Create upload id - which is the workspace id that is sent through
    // This is what is used to create the temp file path
    // "temp_{upload_id}_{filename}"
    // this is only temporary to ensure that the chunks are appended to the same temp file
    let upload_id = format!("{}_upload", workspace_id);

    // Logging info
    tracing::info!(
        "Processing request: chunk {}/{}, upload_id: {}",
        chunk_number,
        total_chunks,
        upload_id
    );

    // Process multipart form starting point
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
                            tracing::info!("Non-final chunk processed, awaiting more chunks");
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
                        tracing::info!("Final chunk received, processing complete file");
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
    // At this point, we know:
    // 1. We have processed the final chunk (checked during file processing)
    // 2. We have a complete file and temp file path
    // 3. We can proceed with final processing to PostGIS
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

    if final_path.extension().and_then(|e| e.to_str()) == Some("shp") {
        if let Err(e) = validate_shapefile_components(&final_path).await {
            let error = json!({
                "error": "Invalid shapefile upload",
                "details": e
            });
            return Err((StatusCode::BAD_REQUEST, Json(error)));
        }
    }

    let layer = Layer::from_req(layer_info, user);

    match process_layer(&state, &layer, user, &final_path).await {
        Ok(json_response) => {
            // Cleanup file after successful processing
            if let Err(cleanup_err) = fs::remove_file(&final_path).await {
                tracing::error!(
                    "Failed to clean up file after successful upload: {}",
                    cleanup_err
                );
                // Continue with success response even if cleanup fails - NEED TO CHANGE THIS
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

    // Get workspace member
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

    // TODO Check permissions - WE NEED TO RENAME THIS TO SOMETHING OTHER THAN CREATE
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

    // Write the record to database (e.g. DynamoDB)
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

async fn validate_shapefile_components(file_path: &Path) -> Result<(), String> {
    // Extract the actual filename from temp_workspaceId_filename.shp pattern
    let full_name = file_path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("Invalid shapefile path")?;

    // Split by underscore to handle temp_workspaceId_filename pattern
    let parts: Vec<&str> = full_name.split('_').collect();
    if parts.len() < 3 {
        return Err("Invalid temp file name pattern".to_string());
    }

    // Reconstruct the base filename without extension
    let actual_file_stem = parts[2..].join("_");
    let file_stem = actual_file_stem.trim_end_matches(".shp");

    let parent_dir = file_path.parent().ok_or("Couldn't get parent directory")?;

    let required_files = [".shp", ".dbf", ".shx"];

    // Now check for temp_{workspace_id}_{filename}.{ext} pattern
    for ext in required_files {
        let temp_prefix = format!("temp_{}_{}", parts[1], file_stem);
        let component_path = parent_dir.join(format!("{}{}", temp_prefix, ext));

        tracing::info!("Checking for component: {}", component_path.display());

        if !component_path.exists() {
            return Err(format!("Missing required shapefile component: {}", ext));
        }

        // Check if file is empty
        let metadata = fs::metadata(&component_path)
            .await
            .map_err(|e| format!("Failed to read {} metadata: {}", ext, e))?;

        if metadata.len() == 0 {
            return Err(format!("Shapefile component {} is empty", ext));
        }
    }

    // Handle optional .prj similarly
    let temp_prefix = format!("temp_{}_{}", parts[1], file_stem);
    let prj_path = parent_dir.join(format!("{}.prj", temp_prefix));
    if prj_path.exists() {
        tracing::info!("Optional .prj file is present");
    } else {
        tracing::warn!("Optional .prj file is missing");
    }

    Ok(())
}
