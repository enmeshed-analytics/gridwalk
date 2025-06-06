use crate::User;
use anyhow::{anyhow, Result};
use duckdb_postgis::duckdb_load::launch_process_file;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgRow;
use sqlx::{FromRow, Row};
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

impl<'r> FromRow<'r, PgRow> for Layer {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        Ok(Layer {
            id: row.try_get("id")?,
            workspace_id: row.try_get("workspace_id")?,
            connection_id: row.try_get("connection_id")?,
            name: row.try_get("name")?,
            uploaded_by: row.try_get("uploaded_by")?,
            created_at: row.try_get("created_at")?,
        })
    }
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

    pub async fn from_id<'e, E>(executor: E, source_id: &Uuid) -> Result<Self, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT * FROM gridwalk.layers WHERE id = $1";
        let layer = sqlx::query_as::<_, Layer>(query)
            .bind(source_id)
            .fetch_one(executor)
            .await?;
        Ok(layer)
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
    pub async fn save_layer_info<'e, E>(&self, executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "INSERT INTO gridwalk.layers (id, workspace_id, connection_id, name, uploaded_by, created_at) VALUES ($1, $2, $3, $4, $5, $6)";
        sqlx::query(query)
            .bind(self.id)
            .bind(self.workspace_id)
            .bind(self.connection_id)
            .bind(&self.name)
            .bind(self.uploaded_by)
            .bind(self.created_at)
            .execute(executor)
            .await?;
        Ok(())
    }
}
