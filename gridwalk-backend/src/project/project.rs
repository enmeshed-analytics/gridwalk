use crate::{User, Workspace};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgRow;
use sqlx::{FromRow, Row};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub workspace_id: Uuid,
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl<'r> FromRow<'r, PgRow> for Project {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            workspace_id: row.try_get("workspace_id")?,
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            owner_id: row.try_get("owner")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

impl Project {
    pub fn new(workspace: &Workspace, user: &User, name: String) -> Self {
        Project {
            workspace_id: workspace.id,
            id: Uuid::new_v4(),
            name,
            owner_id: user.id,
            created_at: chrono::Utc::now(),
        }
    }

    pub async fn get<'e, E>(
        executor: E,
        workspace_id: &Uuid,
        project_id: &Uuid,
    ) -> Result<Self, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT * FROM app_data.projects WHERE workspace_id = $1 AND id = $2";
        let project = sqlx::query_as::<_, Project>(query)
            .bind(workspace_id)
            .bind(project_id)
            .fetch_one(executor)
            .await?;

        Ok(project)
    }

    pub async fn save<'e, E>(&self, executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "INSERT INTO app_data.projects (id, workspace_id, name, owner, created_at)
                     VALUES ($1, $2, $3, $4, $5)";
        sqlx::query(query)
            .bind(self.id)
            .bind(self.workspace_id)
            .bind(&self.name)
            .bind(self.owner_id)
            .bind(self.created_at)
            .execute(executor)
            .await?;
        Ok(())
    }

    // TODO: Implement this. Make sure all related data is also deleted or archived or ...
    pub async fn delete<'e, E>(&self, _executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        Ok(())
    }

    pub async fn all_for_workspace<'e, E>(
        executor: E,
        workspace: &Workspace,
    ) -> Result<Vec<Project>, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT * FROM app_data.projects WHERE workspace_id = $1";
        let projects = sqlx::query_as::<_, Project>(query)
            .bind(workspace.id)
            .fetch_all(executor)
            .await?;

        if projects.is_empty() {
            return Ok(vec![]);
        }

        Ok(projects)
    }
}
