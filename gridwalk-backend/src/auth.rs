use crate::core::User;
use crate::{app_state::AppState, core::Session};
use axum::{
    body::Body,
    extract::{FromRef, State},
    http::{Request, StatusCode},
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
    TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, Response> {
    let token = auth.token();
    match Session::from_id(&state.app_data, token).await {
        Ok(session) => {
            if let Some(user_id) = session.user_id {
                match User::from_id(&state.app_data, &user_id).await {
                    Ok(user) => {
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
