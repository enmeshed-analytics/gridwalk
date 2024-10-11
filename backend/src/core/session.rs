use crate::app_state::AppState;
use crate::core::create_id;
use crate::core::User;
use crate::data::Database;
use anyhow::Result;
use async_trait::async_trait;
use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts, StatusCode},
};
use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize)]
pub struct Session {
    pub id: String,
    pub user_id: Option<String>,
}

#[async_trait]
impl<S, D> FromRequestParts<S> for Session
where
    S: Send + Sync,
    D: Database + Send + Sync + 'static,
    S: std::ops::Deref<Target = Arc<AppState<D>>>,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "))
            .ok_or((
                StatusCode::UNAUTHORIZED,
                "Missing or invalid authorization header".to_string(),
            ))?;

        // Use the existing from_id method to validate and retrieve the session
        match Session::from_id(state.app_data.clone(), auth_header).await {
            Ok(session) => Ok(session),
            Err(_) => Err((
                StatusCode::UNAUTHORIZED,
                "Invalid session token".to_string(),
            )),
        }
    }
}

impl Session {
    // TODO: dead code
    pub async fn from_id<T: Database>(database: T, id: &str) -> Result<Self> {
        database.get_session_by_id(id).await
    }

    pub async fn create<T: Database>(database: T, user: Option<&User>) -> Result<Self> {
        let session_id = create_id(30).await;

        match user {
            Some(u) => database.create_session(Some(u), &session_id).await?,
            None => database.create_session(None, &session_id).await?,
        };

        match user {
            Some(u) => Ok(Session {
                id: session_id,
                user_id: Some(u.clone().id),
            }),
            None => Ok(Session {
                id: session_id,
                user_id: None,
            }),
        }
    }

    pub async fn delete<T: Database>(&self, database: T) -> Result<()> {
        database.delete_session(&self.id).await?;
        Ok(())
    }
}
