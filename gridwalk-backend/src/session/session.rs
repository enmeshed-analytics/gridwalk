use crate::app_state::AppState;
use crate::data::Database;
use crate::User;
use anyhow::Result;
use async_trait::async_trait;
use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts, StatusCode},
};
use serde::Serialize;
use std::{str::FromStr, sync::Arc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
}

#[async_trait]
impl<S> FromRequestParts<S> for Session
where
    S: Send + Sync,
    S: std::ops::Deref<Target = Arc<AppState>>,
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

        // Convert the auth_header to a UUID
        let session_id = Uuid::from_str(auth_header).map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                "Invalid session token".to_string(),
            )
        })?;

        // Use the existing from_id method to validate and retrieve the session
        match Session::from_id(&state.app_data, &session_id).await {
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
    pub async fn from_id(database: &Arc<dyn Database>, id: &Uuid) -> Result<Self> {
        database.get_session_by_id(id).await
    }

    pub async fn create(database: &Arc<dyn Database>, user: Option<&User>) -> Result<Self> {
        let session_id = Uuid::new_v4();

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

    pub async fn delete(&self, database: &Arc<dyn Database>) -> Result<()> {
        database.delete_session(&self.id).await?;
        Ok(())
    }
}
