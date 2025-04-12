use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PostgisConnection {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub schema: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum VectorConnectorConfig {
    Postgis(PostgisConnection),
    // GeoPackage(GeoPackageConnection), TODO: implement this
    // Other vector configurations…
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum Connector {
    Vector(VectorConnectorConfig),
}

// Trait for all vector-based geospatial data sources
#[async_trait]
pub trait VectorConnector: Send + Sync {
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
