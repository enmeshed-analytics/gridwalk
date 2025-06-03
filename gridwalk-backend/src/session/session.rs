use crate::User;
use anyhow::Result;
use chrono::{DateTime, Utc};
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
        // Extract each field from the row
        // Refresh token may be null, so we need to handle it as an Option
        let id: Uuid = row.try_get("id")?;
        let user_id = row.try_get("user_id")?;
        let expiry: DateTime<Utc> = row.try_get("session_expiry")?;

        // Construct the Session struct
        Ok(Session {
            id,
            user_id,
            expiry,
        })
    }
}

impl Session {
    pub async fn create(
        pool: &sqlx::Pool<sqlx::Postgres>,
        user: &User,
    ) -> Result<Self, sqlx::Error> {
        let id = Uuid::new_v4();
        let expiry = chrono::Utc::now() + chrono::Duration::days(30);
        let query = "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)";
        sqlx::query(query)
            .bind(id)
            .bind(user.id)
            .bind(expiry)
            .execute(pool)
            .await?;

        Ok(Self {
            id,
            user_id: user.id,
            expiry,
        })
    }

    pub async fn from_id(pool: &sqlx::PgPool, id: &Uuid) -> Result<Self, sqlx::Error> {
        let query = "SELECT * FROM app_data.sessions WHERE id = $1";
        let row = sqlx::query_as::<_, Session>(query)
            .bind(id)
            .fetch_one(pool)
            .await?;
        Ok(row)
    }

    pub async fn delete(&self, pool: &sqlx::PgPool) -> Result<(), sqlx::Error> {
        let query = "DELETE FROM app_data.sessions WHERE id = $1";
        sqlx::query(query).bind(&self.id).execute(pool).await?;
        Ok(())
    }
}
