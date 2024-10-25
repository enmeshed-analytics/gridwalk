use crate::app_state::AppState;
use crate::auth::auth_middleware;
use crate::routes::{
    add_workspace_member, create_connection, create_workspace, generate_os_token, health_check,
    list_sources, login, logout, profile, register, remove_workspace_member, tiles, upload_layer,
};
use axum::{
    middleware,
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::{self, TraceLayer};
use tracing::Level;

pub fn create_app(app_state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let shared_state = Arc::new(app_state);

    Router::new()
        .route("/health", get(health_check))
        .route("/logout", post(logout))
        .route("/profile", get(profile))
        .route("/workspace", post(create_workspace))
        .route("/workspace/members", post(add_workspace_member))
        .route(
            "/workspace/:workspace_id/members/:user_id",
            delete(remove_workspace_member),
        )
        .route("/connection", post(create_connection))
        .route(
            "/workspace/:workspace_id/connection/:connection_id/sources",
            get(list_sources),
        )
        .layer(middleware::from_fn_with_state(
            shared_state.clone(),
            auth_middleware,
        ))
        .route("/tiles/:workspace_id/:connection_id/:z/:x/:y", get(tiles))
        .route("/register", post(register))
        .route("/upload_layer", post(upload_layer))
        .route("/login", post(login))
        .route("/os-token", get(generate_os_token))
        .with_state(shared_state)
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(trace::DefaultMakeSpan::new().level(Level::INFO))
                .on_response(trace::DefaultOnResponse::new().level(Level::INFO)),
        )
        .layer(cors)
}
