use crate::data::Database;
use crate::{ConnectionCapacityInfo, ConnectionTenancy, User, WorkspaceConnectionAccess};
use anyhow::{anyhow, Result};
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

//use crate::{ConnectionAccess, ConnectionAccessConfig};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Workspace {
    pub id: Uuid,
    pub name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub active: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkspaceMember {
    pub workspace_id: Uuid,
    pub user_id: Uuid,
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
    pub async fn from_id(database: &Arc<dyn Database>, id: &Uuid) -> Result<Self> {
        Ok(database.get_workspace_by_id(id).await?)
    }

    pub async fn save(&self, database: &Arc<dyn Database>, admin: &User) -> Result<()> {
        // TODO: Use transaction

        let connections = database
            // Capacity value is not used in the query
            .get_connections_by_tenancy(&ConnectionTenancy::Shared { capacity: 0 })
            .await?;

        // For each connection, check if it has spare capacity. Get futures first
        let capacity_futures = connections.iter().map(|c| async move {
            match c.capacity_info(&database).await {
                Ok(capacity) => Ok(capacity),
                Err(_) => Err(anyhow::anyhow!("failed to get connection capacity")),
            }
        });

        let connection_capacity_vec: Vec<Result<ConnectionCapacityInfo, anyhow::Error>> =
            join_all(capacity_futures).await;

        // Filter out Errors
        let connection_capacity_vec: Vec<ConnectionCapacityInfo> = connection_capacity_vec
            .into_iter()
            .filter_map(|x| x.ok())
            .collect();

        // Pick the connection with highest percentage of free capacity
        let mut connection_capacity_vec = connection_capacity_vec
            .into_iter()
            .filter(|c| c.usage_count < c.capacity)
            .collect::<Vec<ConnectionCapacityInfo>>();
        connection_capacity_vec.sort_by(|a, b| {
            let a_percentage = (a.capacity - a.usage_count) as f64 / a.capacity as f64;
            let b_percentage = (b.capacity - b.usage_count) as f64 / b.capacity as f64;
            a_percentage
                .partial_cmp(&b_percentage)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        connection_capacity_vec.reverse();
        let selected_connection = connection_capacity_vec
            .get(0)
            .ok_or_else(|| anyhow!("No connections with spare capacity"))?;

        database.create_workspace(&self, admin).await?;
        // Create ConnectionAccess to shared primary db
        WorkspaceConnectionAccess {
            connection_id: selected_connection.connection_id,
            workspace_id: self.id.clone(),
        }
        .save(database)
        .await?;

        Ok(())
    }

    pub async fn delete(&self, database: &Arc<dyn Database>) -> Result<()> {
        // TODO: Fix this - leaves dangling references (cascade delete in db and add checks in logic)
        database.delete_workspace(self).await
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
        requesting_member: &WorkspaceMember,
        user: &User,
    ) -> Result<()> {
        if requesting_member.role != WorkspaceRole::Admin {
            Err(anyhow!("Only Admin can remove members"))?
        }

        database.remove_workspace_member(&self, user).await?;
        Ok(())
    }

    pub async fn get_user_workspaces(
        database: &Arc<dyn Database>,
        user: &User,
    ) -> Result<Vec<Workspace>> {
        database.get_user_workspaces(user).await
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
