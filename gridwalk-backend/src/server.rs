use crate::auth::auth_middleware;
use crate::AppState;
use crate::{
    add_workspace_member, change_password, create_datastore, create_map, create_workspace,
    delete_map, delete_workspace, generate_os_token, get_all_datastores, get_datastore,
    get_datastore_capacity, get_geometry_type, get_maps, get_workspace, get_workspace_members,
    get_workspaces, health_check, list_datastores, list_sources, login, logout, profile, register,
    remove_workspace_member, test_connection, tiles, upload_layer,
};
use axum::{
    extract::DefaultBodyLimit,
    middleware,
    routing::{delete, get, post},
    Router,
};
use http::Method;
use http::{
    header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
    HeaderName,
};
use std::sync::Arc;
use tower_cookies::CookieManagerLayer;
use tower_http::{
    cors::{Any, CorsLayer},
    limit::RequestBodyLimitLayer,
    trace::{self, TraceLayer},
};
use tracing::Level;

fn create_dynamic_cors() -> CorsLayer {
    let allowed_origins: Vec<String> = vec![
        std::env::var("FRONTEND_URL").unwrap_or_else(|_| "https://gridwalk.co".to_string()),
        "http://localhost:3000".to_string(),
        "http://127.0.0.1:3000".to_string(),
    ];

    let origins = allowed_origins
        .iter()
        .map(|origin| origin.parse().unwrap())
        .collect::<Vec<_>>();

    CorsLayer::new()
        .allow_credentials(true)
        .allow_methods([Method::GET, Method::OPTIONS, Method::POST])
        .allow_headers([
            AUTHORIZATION,
            ACCEPT,
            CONTENT_TYPE,
            HeaderName::from_static("x-file-type"),
            HeaderName::from_static("x-workspace-id"),
            HeaderName::from_static("x-chunk-number"),
            HeaderName::from_static("x-total-chunks"),
            HeaderName::from_static("x-file-size"),
            HeaderName::from_static("x-checksum"),
        ])
        .expose_headers([
            HeaderName::from_static("x-file-type"),
            HeaderName::from_static("x-workspace-id"),
            HeaderName::from_static("x-chunk-number"),
            HeaderName::from_static("x-total-chunks"),
            HeaderName::from_static("x-file-size"),
            HeaderName::from_static("x-checksum"),
        ])
        .allow_origin(origins)
}

pub fn create_app(app_state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let shared_state = Arc::new(app_state);

    let upload_router = Router::new()
        .route("/upload_layer", post(upload_layer))
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(100 * 1024 * 1024))
        .layer(create_dynamic_cors())
        .layer(middleware::from_fn_with_state(
            shared_state.clone(),
            auth_middleware,
        ))
        .with_state(shared_state.clone());

    let upload_router_new = Router::new()
        .route("/upload_layer_v2", post(upload_layer))
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(100 * 1024 * 1024))
        .layer(create_dynamic_cors())
        .layer(middleware::from_fn_with_state(
            shared_state.clone(),
            auth_middleware,
        ))
        .with_state(shared_state.clone());

    let main_router = Router::new()
        .route("/workspaces", get(get_workspaces))
        .route("/logout", post(logout))
        .route("/profile", get(profile))
        .route("/password_change", post(change_password))
        .route("/datastores/connection-test", post(test_connection))
        .route("/datastores", post(create_datastore))
        .route("/datastores", get(get_all_datastores))
        .route("/datastores/:datastore_id", get(get_datastore))
        .route(
            "/datastores/:datastore_id/capacity",
            get(get_datastore_capacity),
        )
        .route("/workspaces", post(create_workspace))
        .route("/workspaces/:workspace_id", get(get_workspace))
        .route("/workspaces/:workspace_id", delete(delete_workspace))
        .route("/workspaces/members", post(add_workspace_member))
        .route(
            "/workspaces/:workspace_id/members",
            get(get_workspace_members),
        )
        .route(
            "/workspaces/:workspace_id/members/:user_id",
            delete(remove_workspace_member),
        )
        .route("/workspaces/:workspace_id/datastores", get(list_datastores))
        .route(
            "/workspaces/:workspace_id/datastores/:datastore_id/sources",
            get(list_sources),
        )
        .route("/workspaces/:workspace_id/maps", post(create_map))
        .route("/workspaces/:workspace_id/maps", get(get_maps))
        .route("/workspaces/:workspace_id/maps/:map_id", delete(delete_map))
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(100 * 1024 * 1024))
        .layer(middleware::from_fn_with_state(
            shared_state.clone(),
            auth_middleware,
        ))
        .with_state(shared_state.clone());

    // Create a separate router for public endpoints
    let public_router = Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/os-token", get(generate_os_token)) // Move this to main router with auth
        .route("/health", get(health_check))
        .with_state(shared_state.clone())
        .layer(cors);

    // Create the tiles router with its specific CORS configuration
    let tiles_router = Router::new()
        .route("/:z/:x/:y", get(tiles))
        .route("/geometry", get(get_geometry_type))
        .layer(create_dynamic_cors())
        .layer(CookieManagerLayer::new())
        .with_state(shared_state.clone());

    // Merge all routers and apply global middleware
    Router::new()
        .merge(main_router)
        .merge(upload_router)
        .merge(upload_router_new)
        .nest(
            "/workspaces/:workspace_id/datastores/:datastore_id/sources/:source_name/tiles",
            tiles_router,
        )
        .merge(public_router)
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(trace::DefaultMakeSpan::new().level(Level::INFO))
                .on_response(trace::DefaultOnResponse::new().level(Level::INFO)),
        )
}
