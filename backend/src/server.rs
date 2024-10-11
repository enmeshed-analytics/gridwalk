use crate::app_state::AppState;
use crate::auth::auth_middleware;
use crate::data::Database;
use crate::routes::{
    add_workspace_member, create_workspace, health_check, login, logout, profile, register, tiles,
};
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::trace::{self, TraceLayer};
use tracing::Level;

pub fn create_app<D: Database>(app_state: AppState<D>) -> Router {
    let shared_state = Arc::new(app_state);

    Router::new()
        .route("/health", get(health_check))
        .route("/logout", post(logout))
        .route("/profile", get(profile::<D>))
        .route("/workspace", post(create_workspace::<D>))
        .route("/workspace/members", post(add_workspace_member::<D>))
        .route("/tiles/:z/:x/:y", get(tiles::<D>))
        .layer(middleware::from_fn_with_state(
            shared_state.clone(),
            auth_middleware,
        ))
        .route("/register", post(register))
        .route("/login", post(login))
        .with_state(shared_state)
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(trace::DefaultMakeSpan::new().level(Level::INFO))
                .on_response(trace::DefaultOnResponse::new().level(Level::INFO)),
        )
}
