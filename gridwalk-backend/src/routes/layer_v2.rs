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
use std::error::Error;
use std::path::Path;
use std::sync::Arc;
use tokio::{
    fs::{self, OpenOptions},
    io::AsyncWriteExt,
};

#[derive(Debug, PartialEq)]
enum FileType {
    Geopackage,
    Json,
    GeoJson,
    Shapefile,
    Excel,
    Csv,
    Parquet,
    Unknown,
}

pub async fn upload_layer_v2(
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

    // Add file type check from headers
    let file_type = headers
        .get("x-file-type")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_lowercase());

    // Add file type check from headers
    let is_shapefile = file_type.as_deref() == Some(".zip");
    let shapefile_path = None;

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
    // This is only temporary to ensure that the chunks are appended to the same temp file
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
                        let temp_path = dir_path.join(format!("{upload_id}_{filename}"));
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

                        // Get first chunk to validate
                        if chunk_number == 0 {
                            if let Some(first_chunk) = field.chunk().await.map_err(|e| {
                                let error = json!({
                                    "error": "Failed to read file chunk",
                                    "details": e.to_string()
                                });
                                (StatusCode::BAD_REQUEST, Json(error))
                            })? {
                                // Validate the first chunk
                                tracing::info!("VALIDATING FIRST CHUNK");
                                validate_first_chunk(&first_chunk).await?;

                                // Write the first chunk after validation
                                chunk_bytes += first_chunk.len();
                                file.write_all(&first_chunk).await.map_err(|e| {
                                    let error = json!({
                                        "error": "Failed to write chunk",
                                        "details": e.to_string()
                                    });
                                    (StatusCode::INTERNAL_SERVER_ERROR, Json(error))
                                })?;
                            }
                        }

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

    // Get final path - use shapefile path if it's a shapefile upload
    let final_path = if is_shapefile {
        shapefile_path.ok_or_else(|| {
            let error = json!({
                "error": "No .shp file found in shapefile upload",
                "details": null
            });
            (StatusCode::BAD_REQUEST, Json(error))
        })?
    } else {
        file_path.ok_or_else(|| {
            let error = json!({
                "error": "No file was uploaded",
                "details": null
            });
            (StatusCode::BAD_REQUEST, Json(error))
        })?
    };

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

async fn validate_first_chunk(
    chunk: &[u8],
) -> Result<FileType, (StatusCode, Json<serde_json::Value>)> {
    match determine_file_type(chunk) {
        Ok(file_type) => {
            // Add detailed logging
            tracing::info!("🔍 Detected file type: {:?}", file_type);
            println!("🔍 Detected file type: {:?}", file_type);

            if matches!(file_type, FileType::Unknown) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({
                        "error": "Unsupported file type",
                        "details": "The uploaded file type is not supported"
                    })),
                ));
            }
            Ok(file_type)
        }
        Err(e) => {
            // Add error logging
            tracing::error!("❌ File type detection failed: {}", e);
            println!("❌ File type detection failed: {}", e);

            Err((
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "Invalid file type",
                    "details": e.to_string()
                })),
            ))
        }
    }
}

fn determine_file_type(file_bytes: &[u8]) -> Result<FileType, Box<dyn Error>> {
    let file_type = match_magic_numbers(file_bytes);
    if file_type != FileType::Unknown {
        return Ok(file_type);
    } else {
        let file_type = detect_content_based_type(file_bytes)?;
        return Ok(file_type);
    }
}

fn match_magic_numbers(header: &[u8]) -> FileType {
    match header {
        [0x50, 0x4B, 0x03, 0x04, ..] => FileType::Excel,
        [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, ..] => FileType::Excel,
        [0x50, 0x41, 0x52, 0x31, ..] => FileType::Parquet,
        [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6F, 0x72, 0x6D, 0x61, 0x74, 0x20, 0x33, 0x00, ..] => {
            FileType::Geopackage
        }
        [0x00, 0x00, 0x27, 0x0A, ..] => FileType::Shapefile,
        _ => FileType::Unknown,
    }
}

fn detect_content_based_type(buffer: &[u8]) -> Result<FileType, Box<dyn Error>> {
    // Check for GeoJSON magic numbers/patterns
    if buffer.len() > 20 {
        // Look for {"type":"Feature" pattern
        if let Some(window) = buffer.windows(17).next() {
            if window == b"{\"type\":\"Feature" {
                return Ok(FileType::GeoJson);
            }
        }

        // Look for {"type":"FeatureCollection" pattern
        if let Some(window) = buffer.windows(26).next() {
            if window == b"{\"type\":\"FeatureCollection" {
                return Ok(FileType::GeoJson);
            }
        }

        // Generic JSON check - look for opening curly brace
        if buffer[0] == b'{' {
            return Ok(FileType::Json);
        }
    }

    // Convert buffer to string for CSV check
    if let Ok(text) = String::from_utf8(buffer.to_vec()) {
        if is_valid_csv(&text) {
            return Ok(FileType::Csv);
        }
    }
    Err("Unknown or unsupported file type".into())
}

fn is_valid_csv(content: &str) -> bool {
    let lines: Vec<&str> = content.lines().take(5).collect();

    if lines.len() < 2 {
        return false;
    }

    let first_line_fields = lines[0].split(',').count();
    first_line_fields >= 2
        && lines[1..].iter().all(|line| {
            let fields = line.split(',').count();
            fields == first_line_fields && line.chars().all(|c| c.is_ascii() || c.is_whitespace())
        })
}
