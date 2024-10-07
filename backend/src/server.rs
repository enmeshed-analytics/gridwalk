use crate::app_state::AppState;
use crate::data::Database;
use crate::routes::{health_check, register, tiles};
use axum::{
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
        .route("/register", post(register))
        .route("/tiles/:z/:x/:y", get(tiles::<D>))
        .with_state(shared_state)
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(trace::DefaultMakeSpan::new().level(Level::INFO))
                .on_response(trace::DefaultOnResponse::new().level(Level::INFO)),
        )
}
