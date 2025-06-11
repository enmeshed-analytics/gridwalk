use crate::{User, Workspace};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::fmt;
use std::str::FromStr;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkspaceRole {
    Owner,
    Admin,
    Read,
}

impl fmt::Display for WorkspaceRole {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            WorkspaceRole::Owner => write!(f, "owner"),
            WorkspaceRole::Admin => write!(f, "admin"),
            WorkspaceRole::Read => write!(f, "read"),
        }
    }
}

impl FromStr for WorkspaceRole {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_lowercase().as_str() {
            "owner" => Ok(WorkspaceRole::Owner),
            "admin" => Ok(WorkspaceRole::Admin),
            "read" => Ok(WorkspaceRole::Read),
            _ => Err(format!("Unknown role: {}", s)),
        }
    }
}

impl From<&String> for WorkspaceRole {
    fn from(s: &String) -> Self {
        WorkspaceRole::from_str(s).unwrap_or(WorkspaceRole::Read)
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkspaceMember {
    pub workspace_id: Uuid,
    pub user_id: Uuid,
    pub role: WorkspaceRole,
    pub joined_at: chrono::DateTime<chrono::Utc>,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for WorkspaceMember {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        let role = row.try_get::<String, _>("role").and_then(|r| {
            r.parse::<WorkspaceRole>()
                .map_err(|_| sqlx::Error::Decode("Invalid role".into()))
        })?;
        Ok(Self {
            workspace_id: row.try_get("workspace_id")?,
            user_id: row.try_get("user_id")?,
            role,
            joined_at: row.try_get("joined_at")?,
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkspaceMemberWithEmail {
    pub workspace_id: Uuid,
    pub user_id: Uuid,
    pub role: WorkspaceRole,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub email: String,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for WorkspaceMemberWithEmail {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        let role = row.try_get::<String, _>("role").and_then(|r| {
            r.parse::<WorkspaceRole>()
                .map_err(|_| sqlx::Error::Decode("Invalid role".into()))
        })?;
        Ok(Self {
            workspace_id: row.try_get("workspace_id")?,
            user_id: row.try_get("user_id")?,
            role,
            joined_at: row.try_get("joined_at")?,
            email: row.try_get("email")?,
        })
    }
}

impl WorkspaceMember {
    pub fn new(workspace: &Workspace, user: &User, role: WorkspaceRole) -> Self {
        WorkspaceMember {
            workspace_id: workspace.id,
            user_id: user.id,
            role,
            joined_at: chrono::Utc::now(),
        }
    }

    pub async fn save<'e, E>(&self, executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "INSERT INTO gridwalk.workspace_members (workspace_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4) ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role, joined_at = EXCLUDED.joined_at";
        sqlx::query(query)
            .bind(self.workspace_id)
            .bind(self.user_id)
            .bind(self.role.to_string())
            .bind(self.joined_at)
            .execute(executor)
            .await?;

        Ok(())
    }

    pub async fn get<'e, E>(
        executor: E,
        workspace: &Workspace,
        user: &User,
    ) -> Result<Self, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query =
            "SELECT * FROM gridwalk.workspace_members WHERE workspace_id = $1 AND user_id = $2";
        let row = sqlx::query_as::<_, WorkspaceMember>(query)
            .bind(workspace.id)
            .bind(user.id)
            .fetch_one(executor)
            .await?;

        Ok(row)
    }

    pub async fn delete<'e, E>(&self, executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query =
            "DELETE FROM gridwalk.workspace_members WHERE workspace_id = $1 AND user_id = $2";
        sqlx::query(query)
            .bind(self.workspace_id)
            .bind(self.user_id)
            .execute(executor)
            .await?;

        Ok(())
    }
}
