use crate::error::ApiError;
use crate::User;
use crate::{AppState, Session};
use axum::{
    body::Body,
    extract::{FromRef, State},
    http::{Method, Request},
    middleware::Next,
    response::Response,
};
use axum_extra::headers::{authorization::Bearer, Authorization};
use axum_extra::TypedHeader;
use std::str::FromStr;
use std::sync::Arc;
use tracing::error;
use uuid::Uuid;

#[derive(Debug, Clone, FromRef)]
pub struct AuthUser {
    pub user: Option<User>,
}

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    auth: Option<TypedHeader<Authorization<Bearer>>>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, ApiError> {
    // Allow OPTIONS requests to pass through without auth
    if request.method() == Method::OPTIONS {
        return Ok(next.run(request).await);
    }

    // Require auth for non-OPTIONS requests
    let TypedHeader(auth) = auth.ok_or_else(|| {
        error!("Missing authorization header");
        ApiError::Unauthorized
    })?;

    let token = auth.token();
    let session_id = Uuid::from_str(token).map_err(|_| (ApiError::Unauthorized))?;

    let session = Session::from_id(&*state.pool, &session_id)
        .await
        .map_err(|_| (ApiError::Unauthorized))?;

    if session.expiry < chrono::Utc::now() {
        return Err(ApiError::Unauthorized);
    }

    let user = match User::from_id(&*state.pool, &session.user_id).await {
        Ok(user) => user,
        Err(_) => return Err(ApiError::Unauthorized),
    };

    let mut request = request;
    request
        .extensions_mut()
        .insert(AuthUser { user: Some(user) });
    Ok(next.run(request).await)
}
