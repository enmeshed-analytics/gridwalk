use crate::core::{create_id, User};
use crate::data::Database;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

use super::get_unix_timestamp;

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
    pub org_id: String,
    pub user_id: String,
    pub member_type: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RemoveOrgMember {
    pub org_id: String,
    pub user_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateWorkspace {
    pub name: String,
    pub owner: String,
}

impl Workspace {
    pub async fn from_id<T: Database>(database: T, id: &str) -> Result<Self> {
        Ok(database.get_workspace_by_id(id).await.unwrap())
    }

    pub async fn create<T: Database>(database: T, wsp: &CreateWorkspace) -> Result<()> {
        // Check for existing org with same name
        let id = create_id(30).await;
        let now = get_unix_timestamp();
        let db_resp = database
            .create_workspace(&Workspace {
                id,
                name: wsp.name.clone(),
                owner: wsp.owner.clone(),
                created_at: now,
                active: true,
            })
            .await;

        match db_resp {
            Ok(_) => Ok(()),
            Err(_) => Err(anyhow!("failed to create org")),
        }
    }

    //    pub async fn add_member<T: Database>(
    //        self,
    //        database: T,
    //        req_user: &User,
    //        user: &User,
    //    ) -> Result<()> {
    //        // Check that requesting user has admin role in workspace
    //        database.add_workspace_member(&self, user).await?;
    //        Ok(())
    //    }
    //
    //    pub async fn remove_member<T: Database>(self, database: T, user: &User) -> Result<()> {
    //        database.remove_workspace_member(&self, user).await?;
    //        Ok(())
    //    }
}
