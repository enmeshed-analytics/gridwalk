use crate::app_state::AppState;
use crate::auth::AuthUser;
use crate::core::{Layer, Workspace, WorkspaceRole};
use crate::data::Database;
use axum::{
    extract::{Extension, Multipart, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use duckdb_postgis::duckdb_load::launch_process_file;
use std::path::Path;
use std::sync::Arc;
use tokio::{
    fs::{self, File},
    io::AsyncWriteExt,
};

pub async fn upload_layer<D: Database + ?Sized>(
    State(state): State<Arc<AppState>>,
    Extension(auth_user): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, StatusCode> {
    // Early return if no user
    let user = auth_user.user.as_ref().ok_or(StatusCode::UNAUTHORIZED)?;

    let mut file_data = Vec::new();
    let mut layer_info: Option<Layer> = None;

    // Process multipart form data
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        let name = field.name().ok_or(StatusCode::BAD_REQUEST)?.to_string();
        match name.as_str() {
            "file" => {
                file_data = field
                    .bytes()
                    .await
                    .map_err(|_| StatusCode::BAD_REQUEST)?
                    .to_vec();
                println!("File data size: {} bytes", file_data.len());
            }
            "layer_info" => {
                let json_str = String::from_utf8(
                    field
                        .bytes()
                        .await
                        .map_err(|_| StatusCode::BAD_REQUEST)?
                        .to_vec(),
                )
                .map_err(|_| StatusCode::BAD_REQUEST)?;
                layer_info =
                    Some(serde_json::from_str(&json_str).map_err(|_| StatusCode::BAD_REQUEST)?);
            }
            _ => {}
        }
    }

    let layer_info = layer_info.ok_or(StatusCode::BAD_REQUEST)?;
    let layer = Layer::from_req(layer_info, user);

    // Get workspace and check permissions
    let workspace = Workspace::from_id(&state.app_data, &layer.workspace_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let member = workspace
        .get_member(&state.app_data, user.clone())
        .await
        .map_err(|_| StatusCode::FORBIDDEN)?;

    if member.role == WorkspaceRole::Read {
        return Ok((StatusCode::FORBIDDEN, String::new()));
    }

    // Save file locally
    let dir_path = Path::new("uploads");
    let file_path = dir_path.join(&layer.id);

    fs::create_dir_all(dir_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut file = File::create(&file_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    file.write_all(&file_data)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Process file and upload to PostGIS
    let postgis_uri = "postgresql://admin:password@localhost:5432/gridwalk";
    launch_process_file(
        file_path.to_str().unwrap(),
        &layer.id,
        postgis_uri,
        &layer.workspace_id,
    )
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    println!("Uploaded to POSTGIS!");

    // Write layer record to database
    layer
        .write_record(state.app_data.as_ref())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Return success response
    let json_response =
        serde_json::to_value(&layer).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::OK, Json(json_response).to_string()))
}
