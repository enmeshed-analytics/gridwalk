use axum::{http::StatusCode, response::IntoResponse, Json};
use base64::{engine::general_purpose, Engine as _};
use reqwest::Client;
use serde_json::json;
use std::env;

pub async fn generate_os_token() -> impl IntoResponse {
    let project_api_key = env::var("OS_PROJECT_API_KEY").ok();
    let project_api_secret = env::var("OS_PROJECT_API_SECRET").ok();

    if project_api_key.is_none() || project_api_secret.is_none() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"message": "API key or secret not configured"})),
        )
            .into_response();
    }

    let auth_string = general_purpose::STANDARD.encode(format!(
        "{}:{}",
        project_api_key.unwrap(),
        project_api_secret.unwrap()
    ));

    let client = Client::new();
    let res = client
        .post("https://api.os.uk/oauth2/token/v1")
        .header("Authorization", format!("Basic {}", auth_string))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body("grant_type=client_credentials")
        .send()
        .await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                let data = response.json::<serde_json::Value>().await.unwrap();
                (StatusCode::OK, Json(data)).into_response()
            } else {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"message": "Error generating token", "error": format!("HTTP error! status: {}", response.status())}))
                ).into_response()
            }
        }
        Err(e) => {
            eprintln!("Error generating token: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"message": "Error generating token", "error": e.to_string()})),
            )
                .into_response()
        }
    }
}
