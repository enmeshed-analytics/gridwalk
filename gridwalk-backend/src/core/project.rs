use super::{get_unix_timestamp, Workspace, WorkspaceRole};
use crate::core::User;
use crate::data::Database;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProject {
    pub workspace_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub workspace_id: String,
    pub id: String,
    pub name: String,
    pub uploaded_by: String,
    pub created_at: u64,
}

impl Project {
    pub fn from_req(req: CreateProject, user: &User) -> Self {
        Project {
            workspace_id: req.workspace_id,
            id: Uuid::new_v4().to_string(),
            name: req.name,
            uploaded_by: user.id.clone(),
            created_at: get_unix_timestamp(),
        }
    }
    pub async fn check_permissions(
        &self,
        database: &Arc<dyn Database>,
        user: &User,
        workspace: &Workspace,
    ) -> Result<()> {
        // Get workspace member
        let requesting_member = workspace.get_member(database, user).await?;
        if requesting_member.role == WorkspaceRole::Read {
            return Err(anyhow!(
                "User does not have permissions to create projects."
            ));
        }
        Ok(())
    }

    pub async fn write_project_record(&self, database: &Arc<dyn Database>) -> Result<()> {
        database.create_project(self).await?;
        Ok(())
    }
}