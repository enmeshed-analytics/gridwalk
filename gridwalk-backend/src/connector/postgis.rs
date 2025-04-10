use super::GeometryType;
use super::PostgresConnection;
use super::VectorConnector;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use deadpool_postgres::{Config, Pool, Runtime};
use postgres_native_tls::MakeTlsConnector;
use std::sync::Arc;
use tokio_postgres::NoTls;

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
impl VectorConnector for PostgisConnector {
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
