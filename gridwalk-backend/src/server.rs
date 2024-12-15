use crate::app_state::AppState;
use crate::auth::auth_middleware;
use crate::routes::*;
use axum::{
    extract::DefaultBodyLimit,
    middleware,
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;
use tower_http::{
    cors::{Any, CorsLayer},
    limit::RequestBodyLimitLayer,
    trace::{self, TraceLayer},
};
use tracing::Level;

pub fn create_app(app_state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let shared_state = Arc::new(app_state);

    Router::new()
        .route("/projects", get(get_projects))
        .route("/projects", delete(delete_project))
        .route("/workspaces", get(get_workspaces))
        .route("/logout", post(logout))
        .route("/profile", get(profile))
        .route("/password_reset", post(reset_password))
        .route("/workspace", post(create_workspace))
        .route("/workspace/members", post(add_workspace_member))
        .route(
            "/workspace/:workspace_id/members",
            get(get_workspace_members),
        )
        .route(
            "/workspace/:workspace_id/members/:user_id",
            delete(remove_workspace_member),
        )
        .route("/connection", post(create_connection))
        .route(
            "/workspaces/:workspace_id/connections",
            get(list_connections),
        )
        .route(
            "/workspaces/:workspace_id/connections/:connection_id/sources",
            get(list_sources),
        )
        .route("/create_project", post(create_project))
        .route("/upload_layer", post(upload_layer))
        .route("/workspaces/:workspace_id/connections/:connection_id/sources/:source_name/tiles/:z/:x/:y", get(tiles))
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(100 * 1024 * 1024))
        .layer(middleware::from_fn_with_state(
            shared_state.clone(),
            auth_middleware,
        ))
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/os-token", get(generate_os_token))
        .route("/health", get(health_check))
        .with_state(shared_state)
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(trace::DefaultMakeSpan::new().level(Level::INFO))
                .on_response(trace::DefaultOnResponse::new().level(Level::INFO)),
        )
        .layer(cors)
}
