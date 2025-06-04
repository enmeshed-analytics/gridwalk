use crate::User;
use anyhow::Result;
use serde::Serialize;
use sqlx::postgres::PgRow;
use sqlx::{FromRow, Row};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub expiry: chrono::DateTime<chrono::Utc>,
}

impl<'r> FromRow<'r, PgRow> for Session {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        Ok(Session {
            id: row.try_get("id")?,
            user_id: row.try_get("user_id")?,
            expiry: row.try_get("session_expiry")?,
        })
    }
}

impl Session {
    pub async fn create<'e, E>(executor: E, user: &User) -> Result<Self, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let id = Uuid::new_v4();
        let expiry = chrono::Utc::now() + chrono::Duration::days(30);
        let query = "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)";
        sqlx::query(query)
            .bind(id)
            .bind(user.id)
            .bind(expiry)
            .execute(executor)
            .await?;

        Ok(Self {
            id,
            user_id: user.id,
            expiry,
        })
    }

    pub async fn from_id<'e, E>(executor: E, id: &Uuid) -> Result<Self, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT * FROM app_data.sessions WHERE id = $1";
        let row = sqlx::query_as::<_, Session>(query)
            .bind(id)
            .fetch_one(executor)
            .await?;
        Ok(row)
    }

    pub async fn delete(&self, pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
        let query = "DELETE FROM app_data.sessions WHERE id = $1";
        sqlx::query(query).bind(&self.id).execute(pool).await?;
        Ok(())
    }
}
