use crate::{
    data::{Postgres, SessionStore},
    Session, User,
};
use anyhow::Result;
use async_trait::async_trait;
use sqlx::postgres::PgRow;
use sqlx::{FromRow, Row};
use uuid::Uuid;

impl<'r> FromRow<'r, PgRow> for Session {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            user_id: row.try_get("user_id")?,
        })
    }
}

#[async_trait]
impl SessionStore for Postgres {
    async fn create_session(&self, user: Option<&User>, session_id: &Uuid) -> Result<()> {
        let query = "INSERT INTO sessions (id, user_id) VALUES ($1, $2)";
        let result = sqlx::query(&query)
            .bind(session_id)
            .bind(user.map(|u| u.id))
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow::anyhow!("Failed to create session"));
        } else {
            return Ok(());
        }
    }

    async fn get_session_by_id(&self, id: &Uuid) -> Result<Session> {
        let query = "SELECT id, user_id FROM sessions WHERE id = $1";
        let row = sqlx::query(&query).bind(id).fetch_one(&self.pool).await?;

        sqlx::query_as::<_, Session>(query)
            .bind(row.get::<Uuid, _>("id"))
            .bind(row.get::<Option<Uuid>, _>("user_id"))
            .fetch_one(&self.pool)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to fetch session: {}", e))
    }

    async fn delete_session(&self, session_id: &Uuid) -> Result<()> {
        let query = "DELETE FROM sessions WHERE id = $1";
        let result = sqlx::query(query)
            .bind(session_id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow::anyhow!("Failed to delete session"));
        } else {
            return Ok(());
        }
    }
}
