use crate::app_state::AppState;
use crate::data::Database;
use axum::{extract::Multipart, extract::State, http::StatusCode, response::IntoResponse};
use std::path::Path;
use std::sync::Arc;
use tokio::{fs::File, io::AsyncWriteExt};
use uuid::Uuid;

pub async fn upload_layer<D: Database>(
    State(state): State<Arc<AppState<D>>>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    const MAX_FILE_SIZE: usize = 1024 * 1024 * 100; // 100 MB limit
    let upload_dir = "uploads";

    // Ensure the upload directory exists
    if let Err(err) = tokio::fs::create_dir_all(upload_dir).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create upload directory: {}", err),
        )
            .into_response();
    }

    while let Some(mut field) = multipart.next_field().await.unwrap_or(None) {
        let file_name = match field.file_name() {
            Some(name) => name.to_string(),
            None => {
                return (StatusCode::BAD_REQUEST, "File name is required".to_string())
                    .into_response()
            }
        };

        let file_uuid = Uuid::new_v4();
        let file_extension = Path::new(&file_name)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("bin");
        let unique_filename = format!("{}.{}", file_uuid, file_extension);
        let file_path = Path::new(upload_dir).join(&unique_filename);

        let mut file = match File::create(&file_path).await {
            Ok(file) => file,
            Err(err) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to create file: {}", err),
                )
                    .into_response()
            }
        };

        let mut total_bytes = 0;

        while let Some(chunk) = field.chunk().await.unwrap_or(None) {
            total_bytes += chunk.len();
            if total_bytes > MAX_FILE_SIZE {
                return (StatusCode::BAD_REQUEST, "File too large".to_string()).into_response();
            }

            if let Err(err) = file.write_all(&chunk).await {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to write to file: {}", err),
                )
                    .into_response();
            }
        }

        // Here you might want to add the file information to your database
        // state.db.add_file_record(unique_filename, total_bytes).await?;

        return (
            StatusCode::OK,
            format!("File uploaded successfully: {}", unique_filename),
        )
            .into_response();
    }

    (StatusCode::BAD_REQUEST, "No file provided".to_string()).into_response()
}

