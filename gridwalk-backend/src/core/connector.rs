use anyhow::{anyhow, Result};
use async_trait::async_trait;
use deadpool_postgres::{Config, Pool, Runtime};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_postgres::NoTls;

use crate::data::Database;

// TODO: Switch connector_type/postgis_uri to enum to support other connectors
#[derive(Debug, Clone, Deserialize)]
pub struct Connection {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub created_by: String,
    pub connector_type: String,
    pub config: PostgresConnection,
}

impl Connection {
    pub async fn create_record(self, database: &Arc<dyn Database>) -> Result<()> {
        database.create_connection(&self).await?;
        Ok(())
    }

    pub async fn from_id(
        database: &Arc<dyn Database>,
        workspace_id: &str,
        connection_id: &str,
    ) -> Result<Self> {
        let con = database
            .get_workspace_connection(workspace_id, connection_id)
            .await?;
        Ok(con)
    }
}

// Trait for all geospatial data sources
#[async_trait]
pub trait GeoConnector: Send + Sync {
    async fn connect(&mut self) -> Result<()>;
    async fn disconnect(&mut self) -> Result<()>;
    async fn list_sources(&self) -> Result<Vec<String>>;
    async fn get_tile(&self, z: u32, x: u32, y: u32) -> Result<Vec<u8>>;
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PostgresConnection {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
}

#[derive(Clone, Debug)]
pub struct PostgisConfig {
    pool: Arc<Pool>,
}

impl PostgisConfig {
    pub fn new(connection: PostgresConnection) -> Result<Self> {
        println!("Creating new PostgisConfig with connection parameters");
        let mut config = Config::new();
        config.host = Some(connection.host.to_string());
        config.port = Some(connection.port);
        config.dbname = Some(connection.database.to_string());
        config.user = Some(connection.username.to_string());
        config.password = Some(connection.password.to_string());

        let pool = config
            .create_pool(Some(Runtime::Tokio1), NoTls)
            .map_err(|e| anyhow!("Failed to create connection pool: {}", e))?;

        Ok(PostgisConfig {
            pool: Arc::new(pool),
        })
    }
}

#[async_trait]
impl GeoConnector for PostgisConfig {
    async fn connect(&mut self) -> Result<()> {
        println!("Testing connection to PostGIS database");
        let client = self
            .pool
            .get()
            .await
            .map_err(|e| anyhow!("Failed to get client from pool: {}", e))?;
        client
            .query("SELECT 1", &[])
            .await
            .map_err(|e| anyhow!("Failed to execute test query: {}", e))?;
        println!("Connection test successful");
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<()> {
        println!("Disconnect called, but pool remains active for potential future use");
        Ok(())
    }

    async fn list_sources(&self) -> Result<Vec<String>> {
        println!("Listing sources from PostGIS database");
        let client = self
            .pool
            .get()
            .await
            .map_err(|e| anyhow!("Failed to get client from pool: {}", e))?;

        let rows = client
            .query(
                "SELECT DISTINCT f.table_name
                 FROM information_schema.columns f
                 JOIN pg_type t ON f.udt_name = t.typname
                 WHERE t.typtype = 'b'
                 AND t.typname IN ('geometry', 'geography')
                 AND f.table_schema = 'public'",
                &[],
            )
            .await
            .map_err(|e| anyhow!("Failed to execute query to list sources: {}", e))?;

        let sources: Vec<String> = rows.iter().map(|row| row.get(0)).collect();
        println!("Found {} sources", sources.len());
        Ok(sources)
    }

    async fn get_tile(&self, z: u32, x: u32, y: u32) -> Result<Vec<u8>> {
        println!("Fetching MVT for tile z:{} x:{} y:{}", z, x, y);
        let pool = self.pool.as_ref();
        let client = pool.get().await?;
        let table_name = "test";
        let geom_column = "geom";
        let query = format!(
            "
WITH
bounds AS (
  -- Get tile envelope in EPSG:4326
  SELECT ST_Transform(ST_TileEnvelope({z}, {x}, {y}), 4326) AS geom
),
mvt_data AS (
  SELECT
    -- Use the geometry directly in 4326 and prepare for MVT
    ST_AsMVTGeom(
      t.geom,
      bounds.geom,
      4096,
      256,
      true
    ) AS geom,
    t.name
  FROM
    test t,
    bounds
  WHERE
    ST_Intersects(t.geom, bounds.geom)
)
SELECT ST_AsMVT(mvt_data.*, 'blah', 4096, 'geom') AS mvt
FROM mvt_data;
",
            z = z,
            x = x,
            y = y,
        );
        let row = client.query_one(&query, &[]).await?;
        println!("{row:?}");
        let mvt_data: Vec<u8> = row.get(0);
        println!("{mvt_data:?}");
        Ok(mvt_data)
    }
}

#[derive(Clone)]
pub struct GeospatialConfig {
    sources: Arc<RwLock<HashMap<String, Arc<dyn GeoConnector>>>>,
}

impl GeospatialConfig {
    pub fn new() -> Self {
        GeospatialConfig {
            sources: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_connection<T: GeoConnector + 'static>(&self, name: String, source: T) {
        let mut sources = self.sources.write().await;
        sources.insert(name, Arc::new(source));
    }

    pub async fn get_connection(&self, connection_id: &str) -> Result<Arc<dyn GeoConnector>> {
        let sources = self.sources.read().await;
        sources
            .get(connection_id)
            .cloned()
            .ok_or_else(|| anyhow!("Source not found"))
    }

    pub async fn remove_connection(&self, name: &str) -> Option<Arc<dyn GeoConnector>> {
        let mut sources = self.sources.write().await;
        sources.remove(name)
    }
}
