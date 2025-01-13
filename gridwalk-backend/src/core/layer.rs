use super::{get_unix_timestamp, Workspace, WorkspaceRole};
use crate::core::User;
use crate::data::Database;
use anyhow::{anyhow, Result};
use duckdb_postgis;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateLayer {
    pub name: String,
    pub workspace_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layer {
    pub workspace_id: String,
    pub name: String,
    pub uploaded_by: String,
    pub created_at: u64,
}

impl Layer {
    pub fn from_req(req: CreateLayer, user: &User) -> Self {
        Layer {
            workspace_id: req.workspace_id,
            name: req.name,
            uploaded_by: user.id.clone(),
            created_at: get_unix_timestamp(),
        }
    }

    // TODO this should not be named CREATE but something else as it is jsut used to check permissions.
    pub async fn create(
        &self,
        database: &Arc<dyn Database>,
        user: &User,
        workspace: &Workspace,
    ) -> Result<()> {
        // Get workspace member
        let requesting_member = workspace.get_member(database, user).await?;
        if requesting_member.role == WorkspaceRole::Read {
            return Err(anyhow!("User does not have permissions to create layers."));
        }
        Ok(())
    }

    // TODO should the uri be something different now for the prob postgres instance?
    pub async fn send_to_postgis(&self, file_path: &str) -> Result<()> {
        let postgis_uri = "postgresql://admin:password@localhost:5432/gridwalk";
        let layer_data = duckdb_postgis::duckdb_load::launch_process_file(
            file_path,
            &self.name,
            &postgis_uri,
            &self.workspace_id,
        )
        .map_err(|e| anyhow!("Failed to send file to PostGIS: {:?}", e))?;
        println!("{:?}", layer_data);
        println!("Uploaded to POSTGIS BABY!");
        Ok(())
    }

    // Change this to match the pattern used elsewhere
    pub async fn write_record(&self, database: &Arc<dyn Database>) -> Result<()> {
        database.create_layer_record(self).await?;
        Ok(())
    }
}
