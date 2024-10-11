use crate::core::User;
use crate::data::Database;
use anyhow::{anyhow, Result};
use serde::Serialize;
use uuid::Uuid;

use super::{get_unix_timestamp, Workspace, WorkspaceRole};

#[derive(Debug, Clone, Serialize)]
pub struct Layer {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub uploaded_by: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateLayer {
    pub name: String,
}

impl Layer {
    pub async fn create<D: Database>(
        self,
        database: D,
        user: &User,
        wsp: &Workspace,
        create_layer: &CreateLayer,
    ) -> Result<()> {
        // Get workspace member record
        let requesting_member = wsp
            .clone()
            .get_member(database.clone(), user.clone())
            .await?;

        if requesting_member.role == WorkspaceRole::Read {
            Err(anyhow!("User does not have permissions to create layers."))?
        }

        // TODO: Load layer into geodatabase

        let layer = Layer {
            id: Uuid::new_v4().to_string(),
            workspace_id: wsp.clone().id,
            name: create_layer.clone().name,
            uploaded_by: user.clone().id,
            created_at: get_unix_timestamp(),
        };
        database.create_layer(&layer).await?;

        Ok(())
    }
}
