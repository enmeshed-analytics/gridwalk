use crate::data::Database;
use crate::{User, WorkspaceMember};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Workspace {
    pub id: Uuid,
    pub name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub active: bool,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for Workspace {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            active: row.try_get("active")?,
        })
    }
}

impl Workspace {
    pub async fn from_id<'e, E>(executor: E, id: &Uuid) -> Result<Self, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT * FROM app_data.workspaces WHERE id = $1";
        let row = sqlx::query_as::<_, Workspace>(query)
            .bind(id)
            .fetch_one(executor)
            .await?;
        Ok(row)
    }

    pub async fn save<'e, E>(&self, executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "INSERT INTO app_data.workspaces (id, name, created_at, updated_at, active) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at, active = EXCLUDED.active";
        sqlx::query(query)
            .bind(self.id)
            .bind(&self.name)
            .bind(self.created_at)
            .bind(self.updated_at)
            .bind(self.active)
            .execute(executor)
            .await?;

        Ok(())
    }

    pub async fn delete(&self, database: &Arc<dyn Database>) -> Result<()> {
        // TODO: Fix this - leaves dangling references (cascade delete in db and add checks in logic)
        database.delete_workspace(self).await
    }

    pub async fn get_members<'e, E>(&self, executor: E) -> Result<Vec<WorkspaceMember>>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT wm.* FROM app_data.workspace_members wm WHERE wm.workspace_id = $1";
        let rows = sqlx::query_as::<_, WorkspaceMember>(query)
            .bind(self.id)
            .fetch_all(executor)
            .await?;

        Ok(rows)
    }

    pub async fn get_user_workspaces<'e, E>(executor: E, user: &User) -> Result<Vec<Workspace>>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT w.* FROM app_data.workspaces w JOIN app_data.workspace_members wm ON w.id = wm.workspace_id WHERE wm.user_id = $1";
        let rows = sqlx::query_as::<_, Workspace>(query)
            .bind(user.id)
            .fetch_all(executor)
            .await?;

        Ok(rows)
    }
}
