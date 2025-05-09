use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::{CreateLayer, Layer, User, Workspace, WorkspaceRole};
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
use uuid::Uuid;

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

#[derive(Debug)]
struct UploadContext {
    user: User,
    total_chunks: u32,
    chunk_number: u32,
    _workspace_id: Uuid,
    upload_id: String,
    dir_path: std::path::PathBuf,
    layer_info: Option<CreateLayer>,
    file_path: Option<std::path::PathBuf>,
}

impl UploadContext {
    fn update_upload_id_from_path(&mut self, path: &Path) {
        if let Some(filename) = path
            .file_name()
            .and_then(|n| n.to_str())
            .and_then(|n| n.split('_').nth(1))
        {
            self.upload_id = filename.to_string();
        }
    }
}

async fn initialize_upload_context(
    auth_user: &AuthUser,
    headers: &HeaderMap,
) -> Result<UploadContext, (StatusCode, Json<serde_json::Value>)> {
    // Validate user authorization
    let user = auth_user.user.as_ref().ok_or_else(|| {
        let error = json!({
            "error": "Unauthorized request",
            "details": null
        });
        (StatusCode::UNAUTHORIZED, Json(error))
    })?;

    // Extract and validate chunk information
    let total_chunks = headers
        .get("x-total-chunks")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u32>().ok())
        .ok_or_else(|| {
            let error = json!({ "error": "Missing or invalid total chunks" });
            (StatusCode::BAD_REQUEST, Json(error))
        })?;

    let chunk_number = headers
        .get("x-chunk-number")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u32>().ok())
        .ok_or_else(|| {
            let error = json!({ "error": "Missing or invalid chunk number" });
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
    let workspace_id = Uuid::parse_str(workspace_id).map_err(|e| {
        let error = json!({
            "error": "Invalid workspace ID",
            "details": e.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(error))
    })?;

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

    Ok(UploadContext {
        user: user.clone(),
        total_chunks,
        chunk_number,
        _workspace_id: workspace_id,
        upload_id,
        dir_path: dir_path.to_path_buf(),
        layer_info: None,
        file_path: None,
    })
}

pub async fn upload_layer_v2(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    // Ensure that the user has auth to upload layer
    let mut context = initialize_upload_context(&auth_user, &headers).await?;

    // Logging info
    tracing::info!(
        "Processing request: chunk {}/{}, upload_id: {}",
        context.chunk_number,
        context.total_chunks,
        context.upload_id
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
                        tracing::info!("Processing filename: {}", filename);

                        let temp_path = context
                            .dir_path
                            .join(format!("{}_{filename}", context.upload_id));
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
                        if context.chunk_number == 0 {
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
                            context.chunk_number + 1,
                            context.total_chunks,
                            chunk_bytes
                        );

                        if context.chunk_number < context.total_chunks - 1 {
                            tracing::info!("Non-final chunk processed, awaiting more chunks");

                            if context.chunk_number == 0 {
                                context.update_upload_id_from_path(&temp_path);
                            }

                            return Ok((
                                StatusCode::OK,
                                Json(json!({
                                    "status": "chunk_received",
                                    "chunk": context.chunk_number,
                                    "total": context.total_chunks,
                                    "upload_id": context.upload_id,
                                    "bytes_received": chunk_bytes
                                })),
                            ));
                        }
                        tracing::info!("Final chunk received, processing complete file");
                        context.file_path = Some(temp_path);
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

                    context.layer_info = Some(serde_json::from_str(&info_str).map_err(|e| {
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
    let final_path = context.file_path.ok_or_else(|| {
        let error = json!({
            "error": "No file was uploaded",
            "details": null
        });
        (StatusCode::BAD_REQUEST, Json(error))
    })?;

    let layer_info = context.layer_info.ok_or_else(|| {
        let error = json!({
            "error": "No layer info provided",
            "details": null
        });
        (StatusCode::BAD_REQUEST, Json(error))
    })?;

    let layer = Layer::from_req(layer_info, &context.user);

    match process_layer(&state, &layer, &context.user, &final_path).await {
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
    println!("Processing layer: {}", layer.name);
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

    println!("Layer '{}' sent to PostGIS", layer.name);

    // Strip the file extension in the name before writing to database
    // the send to postgis does this automatically in the duckdb code that is called in it
    let clean_name = Path::new(&layer.name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&layer.name);

    println!("Writing layer record to database with name: {}", clean_name);

    // Write the record to the application database
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

fn determine_file_type(buffer: &[u8]) -> Result<FileType, Box<dyn Error>> {
    // Early return if buffer is too small
    if buffer.is_empty() {
        return Err("Empty buffer".into());
    }

    // Check magic numbers first
    let file_type = match buffer {
        // Binary formats
        [0x50, 0x4B, 0x03, 0x04, ..] => {
            // Look for Excel-specific patterns
            if buffer.windows(30).any(|window| {
                window.windows(14).any(|w| w == b"[Content_Types]")
                    || window.windows(11).any(|w| w == b"xl/workbook")
            }) {
                FileType::Excel
            } else {
                FileType::Shapefile
            }
        }
        [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, ..] => FileType::Excel,
        [0x50, 0x41, 0x52, 0x31, ..] => FileType::Parquet,
        [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6F, 0x72, 0x6D, 0x61, 0x74, 0x20, 0x33, 0x00, ..] => {
            FileType::Geopackage
        }
        [0x00, 0x00, 0x27, 0x0A, ..] => FileType::Shapefile,

        // Text-based formats
        _ if buffer.len() > 20 => {
            // GeoJSON checks
            if buffer
                .windows(17)
                .next()
                .map_or(false, |w| w == b"{\"type\":\"Feature")
            {
                FileType::GeoJson
            } else if buffer
                .windows(26)
                .next()
                .map_or(false, |w| w == b"{\"type\":\"FeatureCollection")
            {
                FileType::GeoJson
            }
            // Generic JSON check
            else if buffer[0] == b'{' {
                FileType::Json
            }
            // CSV check
            else if let Ok(text) = String::from_utf8(buffer.to_vec()) {
                if is_csv_like(&text) {
                    FileType::Csv
                } else {
                    FileType::Unknown
                }
            } else {
                FileType::Unknown
            }
        }
        _ => FileType::Unknown,
    };

    Ok(file_type)
}

fn is_csv_like(content: &str) -> bool {
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
