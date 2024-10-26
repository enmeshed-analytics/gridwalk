use super::{get_unix_timestamp, Workspace, WorkspaceRole};
use crate::core::User;
use crate::data::Database;
use anyhow::{anyhow, Result};
use duckdb_postgis;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layer {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub uploaded_by: String,
    pub created_at: u64,
}

impl Layer {
    pub fn from_req(req: Layer, user: &User) -> Self {
        Layer {
            id: Uuid::new_v4().to_string(),
            workspace_id: req.workspace_id,
            name: req.name,
            uploaded_by: user.id.clone(),
            created_at: get_unix_timestamp(),
        }
    }

    pub async fn create<D: Database + ?Sized>(
        &self,
        database: &Arc<dyn Database>,
        user: &User,
        workspace: &Workspace,
    ) -> Result<()> {
        // Get workspace member record
        let requesting_member = workspace.get_member(database, user).await?;

        if requesting_member.role == WorkspaceRole::Read {
            return Err(anyhow!("User does not have permissions to create layers."));
        }

        database.create_layer(self).await?;
        Ok(())
    }

    pub async fn send_to_postgis(&self, file_path: &str) -> Result<()> {
        // Retrieve the PostGIS URI from an environment variable
        let postgis_uri = std::env::var("POSTGIS_URI")
            .map_err(|_| anyhow!("PostGIS URI not set in environment variables"))?;

        let schema = duckdb_postgis::duckdb_load::launch_process_file(
            file_path,
            &self.id,
            &postgis_uri,
            &self.workspace_id,
        )
        .map_err(|e| anyhow!("Failed to send file to PostGIS: {:?}", e))?;

        println!("{:?}", schema);
        Ok(())
    }

    pub async fn write_record<D: Database + ?Sized>(&self, database: &D) -> Result<()> {
        database.create_layer(self).await?;
        Ok(())
    }
}
