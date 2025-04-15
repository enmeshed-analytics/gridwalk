use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::any::Any;

#[async_trait]
pub trait Connector: Send + Sync {
    /// Establish a connection to the data source.
    async fn connect(&mut self) -> Result<()>;

    /// Disconnect from the data source.
    async fn disconnect(&mut self) -> Result<()>;

    // List all data sources in the specified namespace.
    async fn list_sources(&self, namespace: &str) -> Result<Vec<String>>;

    // Returns a reference to self as a `dyn Any` to support downcasting.
    fn as_any(&self) -> &dyn Any;
}

// Trait for all vector-based geospatial data sources
#[async_trait]
pub trait VectorConnector: Connector {
    async fn get_geometry_type(&self, namespace: &str, source_name: &str) -> Result<GeometryType>;
    async fn create_namespace(&self, name: &str) -> Result<()>;
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
