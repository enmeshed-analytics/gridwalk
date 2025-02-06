use crate::User;
use crate::{app_state::AppState, core::Session};
use axum::{
    body::Body,
    extract::{FromRef, State},
    http::{Method, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use axum_extra::headers::{authorization::Bearer, Authorization};
use axum_extra::TypedHeader;
use std::sync::Arc;

#[derive(Debug, Clone, FromRef)]
pub struct AuthUser {
    pub user: Option<User>,
}

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    auth: Option<TypedHeader<Authorization<Bearer>>>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, Response> {
    // Allow OPTIONS requests to pass through without auth
    if request.method() == Method::OPTIONS {
        return Ok(next.run(request).await);
    }

    // Require auth for non-OPTIONS requests
    let TypedHeader(auth) = auth.ok_or_else(|| {
        (StatusCode::UNAUTHORIZED, "Missing authorization header").into_response()
    })?;

    let token = auth.token();
    match Session::from_id(&state.app_data, token).await {
        Ok(session) => {
            if let Some(user_id) = session.user_id {
                match User::from_id(&state.app_data, &user_id).await {
                    Ok(user) => {
                        let mut request = request;
                        request
                            .extensions_mut()
                            .insert(AuthUser { user: Some(user) });
                        Ok(next.run(request).await)
                    }
                    Err(_) => {
                        Err((StatusCode::INTERNAL_SERVER_ERROR, "User not found").into_response())
                    }
                }
            } else {
                Err((StatusCode::UNAUTHORIZED, "Invalid session").into_response())
            }
        }
        Err(_) => Err((StatusCode::UNAUTHORIZED, "Invalid token").into_response()),
    }
}

