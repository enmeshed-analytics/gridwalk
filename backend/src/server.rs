use crate::app_state::AppState;
use crate::routes::{health_check, tiles};
use axum::{routing::get, Router};
use tower_http::trace::{self, TraceLayer};
use tracing::Level;

pub fn create_app(app_state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/tiles/:z/:x/:y", get(tiles))
        .with_state(app_state)
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(trace::DefaultMakeSpan::new().level(Level::INFO))
                .on_response(trace::DefaultOnResponse::new().level(Level::INFO)),
        )
}
