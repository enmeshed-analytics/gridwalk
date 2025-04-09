use crate::data::Database;
use crate::User;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use std::sync::Arc;

use crate::{ConnectionAccess, ConnectionAccessConfig, GeoConnector};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub active: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkspaceMember {
    pub workspace_id: String,
    pub user_id: String,
    pub role: WorkspaceRole,
    pub joined_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkspaceRole {
    Superuser,
    Admin,
    Read,
}

impl fmt::Display for WorkspaceRole {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            WorkspaceRole::Superuser => write!(f, "superuser"),
            WorkspaceRole::Admin => write!(f, "admin"),
            WorkspaceRole::Read => write!(f, "read"),
        }
    }
}

impl FromStr for WorkspaceRole {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_lowercase().as_str() {
            "superuser" => Ok(WorkspaceRole::Superuser),
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
pub struct RemoveOrgMember {
    pub org_id: String,
    pub user_id: String,
}

impl Workspace {
    pub async fn from_id(database: &Arc<dyn Database>, id: &str) -> Result<Self> {
        Ok(database.get_workspace_by_id(id).await?)
    }

    pub async fn create(
        database: &Arc<dyn Database>,
        connection: &Arc<dyn GeoConnector>,
        wsp: &Workspace,
        admin: &User,
    ) -> Result<()> {
        // Check for existing org with same name
        let db_resp = database.create_workspace(wsp, admin).await;

        // Create ConnectionAccess to shared primary db
        let connection_access = ConnectionAccess {
            connection_id: "primary".to_string(),
            workspace_id: wsp.id.clone(),
            access_config: ConnectionAccessConfig::ReadWrite(wsp.id.clone()),
        };
        connection_access.create_record(database).await?;
        let _ = &connection.create_namespace(&wsp.id).await?;

        match db_resp {
            Ok(_) => Ok(()),
            Err(_) => Err(anyhow!("failed to create workspace")),
        }
    }

    pub async fn delete(database: &Arc<dyn Database>, workspace_id: &str) -> Result<()> {
        // TODO: Fix this
        database
            .delete_workspace(&Workspace {
                id: workspace_id.to_string(),
                name: String::new(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                active: false,
            })
            .await
    }

    pub async fn add_member(
        self,
        database: &Arc<dyn Database>,
        req_user: &User,
        user: &User,
        role: WorkspaceRole,
    ) -> Result<()> {
        let requesting_member = self.clone().get_member(&database, &req_user).await?;
        if requesting_member.role != WorkspaceRole::Admin {
            Err(anyhow!("Only Admin can add members"))?
        }

        database.add_workspace_member(&self, user, role).await?;
        Ok(())
    }

    pub async fn get_member(
        &self,
        database: &Arc<dyn Database>,
        user: &User,
    ) -> Result<WorkspaceMember> {
        // TODO: Fix unwrap
        Ok(database.get_workspace_member(&self, user).await.unwrap())
    }

    pub async fn get_members(&self, database: &Arc<dyn Database>) -> Result<Vec<WorkspaceMember>> {
        database.get_workspace_members(self).await
    }

    pub async fn remove_member(
        self,
        database: &Arc<dyn Database>,
        req_user: &User,
        user: &User,
    ) -> Result<()> {
        let requesting_member = self.clone().get_member(&database, &req_user).await?;
        if requesting_member.role != WorkspaceRole::Admin {
            Err(anyhow!("Only Admin can remove members"))?
        }

        database.remove_workspace_member(&self, user).await?;
        Ok(())
    }

    pub async fn get_user_workspaces(
        database: &Arc<dyn Database>,
        user: &User,
    ) -> Result<Vec<String>> {
        database.get_workspaces(user).await
    }
}

impl WorkspaceMember {
    pub async fn get(
        database: &Arc<dyn Database>,
        workspace: &Workspace,
        user: &User,
    ) -> Result<Self> {
        Ok(database
            .get_workspace_member(workspace, user)
            .await
            // TODO: Fix unwrap
            .unwrap())
    }

    pub fn is_admin(&self) -> bool {
        if self.role == WorkspaceRole::Admin {
            return true;
        }
        false
    }
}
