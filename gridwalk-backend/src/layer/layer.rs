use crate::data::Database;
use crate::{User, Workspace, WorkspaceRole};
use anyhow::{anyhow, Result};
//use duckdb_postgis::core_processor::launch_process_file;
use duckdb_postgis::duckdb_load::launch_process_file;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateLayer {
    pub name: String,
    pub workspace_id: Uuid,
    pub connection_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layer {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub connection_id: Uuid,
    pub name: String,
    pub uploaded_by: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl Layer {
    pub fn from_req(req: CreateLayer, user: &User) -> Self {
        Layer {
            id: Uuid::new_v4(),
            workspace_id: req.workspace_id,
            connection_id: req.connection_id,
            name: req.name,
            uploaded_by: user.id.clone(),
            created_at: chrono::Utc::now(),
        }
    }

    pub async fn from_id(database: &Arc<dyn Database>, source_id: &Uuid) -> Result<Self> {
        let layer = database.get_layer(source_id).await?;
        Ok(layer)
    }

    // TODO this should not be named CREATE but something else as it is just used to check permissions.
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

    // TODO: Make this generic to work with all connections
    pub async fn send_to_postgis(&self, file_path: &str) -> Result<()> {
        let postgis_uri = "postgresql://admin:password@localhost:5432/gridwalk"; // TODO: Use pool
        let layer_data = launch_process_file(
            file_path,
            &self.name,
            &postgis_uri,
            &self.workspace_id.to_string(),
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
