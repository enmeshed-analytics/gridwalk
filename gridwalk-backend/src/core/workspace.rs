use crate::core::{get_unix_timestamp, User};
use crate::data::Database;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use std::sync::Arc;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub owner: String,
    pub created_at: u64,
    pub active: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkspaceMember {
    pub workspace_id: String,
    pub user_id: String,
    pub role: WorkspaceRole,
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
    type Err = String; // Using String as error type for simplicity

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
        Ok(database.get_workspace_by_id(id).await.unwrap())
    }

    pub async fn create(database: &Arc<dyn Database>, wsp: &Workspace) -> Result<()> {
        // Check for existing org with same name
        let db_resp = database.create_workspace(wsp).await;

        match db_resp {
            Ok(_) => Ok(()),
            Err(_) => Err(anyhow!("failed to create workspace")),
        }
    }

    pub async fn add_member(
        self,
        database: &Arc<dyn Database>,
        req_user: &User,
        user: &User,
        role: WorkspaceRole,
    ) -> Result<()> {
        let requesting_member = self.clone().get_member(&database, req_user.clone()).await?;

        println!(
            "{} is {} of the {} workspace",
            req_user.first_name, requesting_member.role, self.name
        );

        if requesting_member.role != WorkspaceRole::Admin {
            Err(anyhow!("Only Admin can add members"))?
        }

        let now = get_unix_timestamp();
        database
            .add_workspace_member(&self, user, role, now)
            .await?;
        Ok(())
    }

    pub async fn get_member(
        self,
        database: &Arc<dyn Database>,
        user: User,
    ) -> Result<WorkspaceMember> {
        // TODO: Fix unwrap
        Ok(database.get_workspace_member(self, user).await.unwrap())
    }

    pub async fn remove_member(
        self,
        database: &Arc<dyn Database>,
        req_user: &User,
        user: &User,
    ) -> Result<()> {
        let requesting_member = self.clone().get_member(&database, req_user.clone()).await?;

        println!(
            "{} is {} of the {} workspace",
            req_user.first_name, requesting_member.role, self.name
        );

        if requesting_member.role != WorkspaceRole::Admin {
            Err(anyhow!("Only Admin can remove members"))?
        }

        database.remove_workspace_member(&self, user).await?;
        Ok(())
    }
}
