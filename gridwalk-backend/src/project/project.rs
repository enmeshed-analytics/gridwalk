use crate::core::get_unix_timestamp;
use crate::data::Database;
use crate::{User, Workspace, WorkspaceRole};
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

    pub async fn delete_project_record(&self, database: &Arc<dyn Database>) -> Result<()> {
        database.delete_project(self).await?;
        Ok(())
    }

    pub async fn get_workspace_projects(
        database: &Arc<dyn Database>,
        workspace: &Workspace,
    ) -> Result<Vec<Project>> {
        // Get projects from database
        database.get_projects(&workspace.id).await
    }
}
