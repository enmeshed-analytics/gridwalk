use anyhow::{anyhow, Result};
use async_trait::async_trait;
use deadpool_postgres::{Config, Pool, Runtime};
use native_tls;
use postgres_native_tls::MakeTlsConnector;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_postgres::NoTls;

use crate::{data::Database, Workspace};

// TODO: Switch connector_type/postgis_uri to enum to support other connectors
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Connection {
    pub id: String,
    pub name: String,
    pub connector_type: String,
    pub config: PostgresConnection,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum GeometryType {
    Point,
    LineString,
    Polygon,
    MultiPoint,
    MultiLineString,
    MultiPolygon,
    GeometryCollection,
}

impl Connection {
    pub async fn create_record(self, database: &Arc<dyn Database>) -> Result<()> {
        database.create_connection(&self).await?;
        Ok(())
    }

    pub async fn from_name(database: &Arc<dyn Database>, connection_name: &str) -> Result<Self> {
        let con = database.get_connection(connection_name).await?;
        Ok(con)
    }

    //pub async fn delete(&self, database: &Arc<dyn Database>) -> Result<()> {
    //    database.delete_workspace_connection(self).await
    //}
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionAccess {
    pub connection_id: String,
    pub workspace_id: String,
    pub access_config: ConnectionAccessConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum ConnectionAccessConfig {
    Admin(String),
    ReadWrite(String),
    ReadOnly(String),
}

impl ConnectionAccessConfig {
    pub fn from_str(variant: &str, path: String) -> Result<Self, String> {
        match variant.to_lowercase().as_str() {
            "admin" => Ok(ConnectionAccessConfig::Admin(path)),
            "readwrite" => Ok(ConnectionAccessConfig::ReadWrite(path)),
            "readonly" => Ok(ConnectionAccessConfig::ReadOnly(path)),
            _ => Err(format!("Invalid variant name: {}", variant)),
        }
    }

    pub fn variant_name(&self) -> &'static str {
        match self {
            ConnectionAccessConfig::Admin(_) => "Admin",
            ConnectionAccessConfig::ReadWrite(_) => "ReadWrite",
            ConnectionAccessConfig::ReadOnly(_) => "ReadOnly",
        }
    }

    pub fn path(&self) -> &String {
        match self {
            ConnectionAccessConfig::Admin(v)
            | ConnectionAccessConfig::ReadWrite(v)
            | ConnectionAccessConfig::ReadOnly(v) => v,
        }
    }
}

impl ConnectionAccess {
    pub async fn create_record(self, database: &Arc<dyn Database>) -> Result<()> {
        database.create_connection_access(&self).await?;
        Ok(())
    }

    pub async fn get_all(
        database: &Arc<dyn Database>,
        wsp: &Workspace,
    ) -> Result<Vec<ConnectionAccess>> {
        database.get_accessible_connections(wsp).await
    }

    pub async fn get(database: &Arc<dyn Database>, wsp: &Workspace, con_id: &str) -> Result<Self> {
        let con = database.get_accessible_connection(wsp, con_id).await?;
        Ok(con)
    }
}

// Trait for all geospatial data sources
#[async_trait]
pub trait GeoConnector: Send + Sync {
    async fn connect(&mut self) -> Result<()>;
    async fn get_geometry_type(&self, namespace: &str, source_name: &str) -> Result<GeometryType>;
    async fn disconnect(&mut self) -> Result<()>;
    async fn create_namespace(&self, name: &str) -> Result<()>;
    async fn list_sources(&self, namespace: &str) -> Result<Vec<String>>;
    async fn get_tile(
        &self,
        namespace: &str,
        source_name: &str,
        z: u32,
        x: u32,
        y: u32,
    ) -> Result<Vec<u8>>;
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PostgresConnection {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub schema: Option<String>,
}

#[derive(Clone, Debug)]
pub struct PostgisConnector {
    pool: Arc<Pool>,
}

impl PostgisConnector {
    pub fn new(connection: PostgresConnection) -> Result<Self> {
        let mut config = Config::new();
        config.host = Some(connection.host.to_string());
        config.port = Some(connection.port);
        config.dbname = Some(connection.database.to_string());
        config.user = Some(connection.username.to_string());
        config.password = Some(connection.password.to_string());

        let is_local = std::env::var("GW_LOCAL")
            .map(|val| val == "true")
            .unwrap_or(false);

        let pool = if is_local {
            config
                .create_pool(Some(Runtime::Tokio1), NoTls)
                .map_err(|e| anyhow!("Failed to create connection pool: {}", e))?
        } else {
            let mut builder = native_tls::TlsConnector::builder();
            // TODO: For testing - remove this line once connection works and replace with proper cert verification
            builder.danger_accept_invalid_certs(true);
            let connector = MakeTlsConnector::new(builder.build().unwrap());
            config
                .create_pool(Some(Runtime::Tokio1), connector)
                .map_err(|e| anyhow!("Failed to create connection pool: {}", e))?
        };

        Ok(PostgisConnector {
            pool: Arc::new(pool),
        })
    }
}

#[async_trait]
impl GeoConnector for PostgisConnector {
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

    async fn create_namespace(&self, name: &str) -> Result<()> {
        let client = self
            .pool
            .get()
            .await
            .map_err(|e| anyhow!("Failed to get client from pool: {}", e))?;
        let escaped_name = format!("\"{}\"", name);
        let query = format!("CREATE SCHEMA IF NOT EXISTS {}", escaped_name);
        client
            .execute(&query, &[])
            .await
            .map_err(|e| anyhow!("Failed to execute query to create namespace: {}", e))?;
        Ok(())
    }

    async fn list_sources(&self, namespace: &str) -> Result<Vec<String>> {
        let client = self
            .pool
            .get()
            .await
            .map_err(|e| anyhow!("Failed to get client from pool: {}", e))?;

        // query to list all tables within the schema given in the namespace parameter
        let rows = client
            .query(
                "SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = $1",
                &[&namespace],
            )
            .await
            .map_err(|e| anyhow!("Failed to execute query to list sources: {}", e))?;
        let sources: Vec<String> = rows.iter().map(|row| row.get(0)).collect();
        Ok(sources)
    }

    async fn get_tile(
        &self,
        namespace: &str,
        source_name: &str,
        z: u32,
        x: u32,
        y: u32,
    ) -> Result<Vec<u8>> {
        let pool = self.pool.as_ref();
        let client = pool.get().await?;

        // First, check which geometry column exists
        let check_column_query = format!(
            "SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = $1 
            AND table_name = $2 
            AND column_name IN ('geom', 'geometry')",
        );

        let geom_column: String = client
            .query_one(&check_column_query, &[&namespace, &source_name])
            .await?
            .get(0);

        let query = format!(
            "
                WITH bounds AS (
                    SELECT ST_Transform(ST_TileEnvelope({z}, {x}, {y}), 4326) AS geom
                ),
                mvt_data AS (
                    SELECT ST_AsMVTGeom(
                        t.{source_geom_column},
                        bounds.geom,
                        4096,
                        256,
                        true
                    ) AS geom
                    FROM {table} t,
                    bounds
                    WHERE ST_Intersects(t.{source_geom_column}, bounds.geom)
                )
                SELECT ST_AsMVT(mvt_data.*, '{source_name}') AS mvt
                FROM mvt_data;
                ",
            table = format!("\"{}\".\"{}\"", namespace, source_name),
            source_geom_column = geom_column,
            z = z,
            x = x,
            y = y,
        );

        let row = client.query_one(&query, &[]).await?;
        let mvt_data: Vec<u8> = row.get(0);
        Ok(mvt_data)
    }

    async fn get_geometry_type(&self, namespace: &str, source_name: &str) -> Result<GeometryType> {
        // Let the client and handle the connection
        let client = self
            .pool
            .get()
            .await
            .map_err(|e| anyhow!("Failed to get client from pool: {}", e))?;

        // First check which geometry column exists
        let check_column_query = format!(
            "SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = $1 
            AND table_name = $2 
            AND column_name IN ('geom', 'geometry')",
        );

        // Get the geometry column name
        let geom_column: String = client
            .query_one(&check_column_query, &[&namespace, &source_name])
            .await?
            .get(0);

        // Query to get the geometry type
        let query = format!(
            "SELECT DISTINCT ST_GeometryType({}) 
            FROM \"{}\".\"{}\" 
            LIMIT 1",
            geom_column, namespace, source_name
        );

        let row = client.query_one(&query, &[]).await?;
        let geom_type: String = row.get(0);

        // Map PostGIS geometry type to our GeometryType enum and return the result
        match geom_type.to_uppercase().as_str() {
            "ST_POINT" => Ok(GeometryType::Point),
            "ST_LINESTRING" => Ok(GeometryType::LineString),
            "ST_POLYGON" => Ok(GeometryType::Polygon),
            "ST_MULTIPOINT" => Ok(GeometryType::MultiPoint),
            "ST_MULTILINESTRING" => Ok(GeometryType::MultiLineString),
            "ST_MULTIPOLYGON" => Ok(GeometryType::MultiPolygon),
            "ST_GEOMETRYCOLLECTION" => Ok(GeometryType::GeometryCollection),
            _ => Err(anyhow!("Unsupported geometry type: {}", geom_type)),
        }
    }
}

// The GeospatialConnections struct and its impl block are used to manage live connections
#[derive(Clone)]
pub struct GeoConnections {
    sources: Arc<RwLock<HashMap<String, Arc<dyn GeoConnector>>>>,
}

impl GeoConnections {
    pub fn new() -> Self {
        GeoConnections {
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
