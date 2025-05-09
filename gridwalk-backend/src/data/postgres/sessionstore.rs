use crate::{
    data::{Postgres, SessionStore},
    Session, User,
};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::convert::TryFrom;
use tokio_postgres::{Error, Row};
use uuid::Uuid;

impl TryFrom<&Row> for Session {
    type Error = Error;

    fn try_from(row: &Row) -> Result<Self, Error> {
        Ok(Session {
            id: row.try_get("id")?,
            user_id: row.try_get("user_id")?,
        })
    }
}

#[async_trait]
impl SessionStore for Postgres {
    async fn create_session(&self, user: Option<&User>, session_id: &Uuid) -> Result<()> {
        // Turn `Option<&User>` into an `Option<Uuid>` (Uuid is `Copy`)
        let user_id: Option<Uuid> = user.map(|u| u.id);

        let client = self.pool.get().await?;

        let rows_affected = client
            .execute(
                "INSERT INTO sessions (id, user_id) VALUES ($1, $2)",
                &[session_id, &user_id],
            )
            .await?;

        if rows_affected == 0 {
            Err(anyhow!("Failed to create session"))
        } else {
            Ok(())
        }
    }

    async fn get_session_by_id(&self, id: &Uuid) -> Result<Session> {
        let client = self.pool.get().await?;
        let row = client
            .query_one("SELECT * FROM sessions WHERE id = $1", &[id])
            .await?;
        let session = Session::try_from(&row)?;
        Ok(session)
    }

    async fn delete_session(&self, session_id: &Uuid) -> Result<()> {
        let client = self.pool.get().await?;
        let rows_affected = client
            .execute("DELETE FROM sessions WHERE id = $1", &[session_id])
            .await?;

        if rows_affected == 0 {
            Err(anyhow!("Failed to delete session"))
        } else {
            Ok(())
        }
    }
}
