use crate::data::Database;
use crate::{User, Workspace, WorkspaceRole};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProject {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub workspace_id: Uuid,
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl Project {
    pub fn from_req(req: CreateProject, workspace_id: &Uuid, user: &User) -> Self {
        Project {
            workspace_id: *workspace_id,
            id: Uuid::new_v4(),
            name: req.name,
            owner_id: user.id.clone(),
            created_at: chrono::Utc::now(),
        }
    }

    pub async fn get(
        database: &Arc<dyn Database>,
        workspace_id: &Uuid,
        project_id: &Uuid,
    ) -> Result<Self> {
        let project = database.get_project(workspace_id, project_id).await?;
        Ok(project)
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

    pub async fn save(&self, database: &Arc<dyn Database>) -> Result<()> {
        database.create_project(self).await?;
        Ok(())
    }

    pub async fn delete(&self, database: &Arc<dyn Database>) -> Result<()> {
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
