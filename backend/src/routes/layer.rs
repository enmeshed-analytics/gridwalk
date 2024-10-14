use crate::auth::AuthUser;
use crate::core::{Layer, Workspace, WorkspaceRole};
use crate::data::Database;
use crate::{app_state::AppState, core::CreateLayer};
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

pub async fn upload_layer<D: Database>(
    State(state): State<Arc<AppState<D>>>,
    Extension(auth_user): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, StatusCode> {
    let mut file_data = Vec::new();
    let mut layer_info: Option<CreateLayer> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        let name = field.name().ok_or(StatusCode::BAD_REQUEST)?.to_string();
        match name.as_str() {
            "file" => {
                println!("FILE");
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
    let layer = Layer::from_req(layer_info, auth_user.user.clone().unwrap());
    let workspace = Workspace::from_id(state.app_data.clone(), &layer.workspace_id)
        .await
        .unwrap();
    let member = workspace
        .get_member(state.app_data.clone(), auth_user.user.unwrap())
        .await
        .unwrap();

    // Check requesting user workspace permissions
    if member.role == WorkspaceRole::Read {
        return Ok((StatusCode::FORBIDDEN, format!("")));
    }

    // Save the file data locally
    let file_name = format!("{}", layer.id);
    let dir_path = Path::new("uploads");
    let file_path = dir_path.join(&file_name);

    fs::create_dir_all(dir_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut file = File::create(&file_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    file.write_all(&file_data)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let postgis_uri = "postgresql://admin:password@localhost:5432/gridwalk";
    let _processed_file = launch_process_file(file_path.to_str().unwrap(), &layer.id, postgis_uri);
    println!("Uploaded to POSTGIS!");

    match layer.clone().write_record(state.app_data.clone()).await {
        Ok(_) => {
            let json_response = serde_json::to_value(&layer).unwrap();
            Ok((StatusCode::OK, Json(json_response).to_string()))
        }
        Err(_) => Ok((StatusCode::INTERNAL_SERVER_ERROR, "".to_string())),
    }
}
