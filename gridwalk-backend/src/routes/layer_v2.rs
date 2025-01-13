use crate::app_state::AppState;
use crate::auth::AuthUser;
use axum::{
    extract::{Extension, Multipart, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde_json::json;
use std::error::Error;
use std::sync::Arc;

#[derive(Debug)]
enum FileType {
    Geopackage,
    GeoJson,
    Shapefile,
    Excel,
    Csv,
    Parquet,
    Unknown,
}

pub async fn upload_layer_v2(
    State(_state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    _headers: HeaderMap,
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

    println!("{:?}", user);

    while let Some(field) = multipart.next_field().await.unwrap() {
        // Capture the file name as an owned String if it exists.
        let file_name = field.file_name().map(|name| name.to_string());

        // Get the file bytes
        let file_bytes = field.bytes().await.unwrap();

        // We can now safely use file_name because it's an owned value
        if let Some(file_name) = file_name {
            let file_type = determine_file_type(&file_bytes).unwrap_or(FileType::Unknown);
            println!("File: {}, Detected Type: {:?}", file_name, file_type);
        }
    }

    let response = json!({
        "status": "success",
        "message": "Files processed"
    });

    Ok((StatusCode::OK, Json(response)))
}

fn determine_file_type(file_bytes: &[u8]) -> Result<FileType, Box<dyn Error>> {
    if let Some(file_type) = match_magic_numbers(file_bytes) {
        return Ok(file_type);
    }

    detect_content_based_type(file_bytes)
}

fn match_magic_numbers(header: &[u8]) -> Option<FileType> {
    match header {
        [0x50, 0x4B, 0x03, 0x04, ..] => Some(FileType::Excel),
        [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, ..] => Some(FileType::Excel),
        [0x50, 0x41, 0x52, 0x31, ..] => Some(FileType::Parquet),
        [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6F, 0x72, 0x6D, 0x61, 0x74, 0x20, 0x33, 0x00, ..] => {
            Some(FileType::Geopackage)
        }
        [0x00, 0x00, 0x27, 0x0A, ..] => Some(FileType::Shapefile),
        _ => None,
    }
}

fn detect_content_based_type(buffer: &[u8]) -> Result<FileType, Box<dyn Error>> {
    if let Ok(text) = std::str::from_utf8(buffer) {
        let text_lower = text.trim_start().to_lowercase();

        if text_lower.starts_with("{")
            && text_lower.contains("\"type\"")
            && (text_lower.contains("\"featurecollection\"")
                || text_lower.contains("\"feature\"")
                || text_lower.contains("\"geometry\""))
        {
            return Ok(FileType::GeoJson);
        }

        if is_valid_csv(text) {
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
