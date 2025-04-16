use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::any::Any;
use uuid::Uuid;

#[async_trait]
pub trait Connector: Send + Sync {
    /// Establish a connection to the data source.
    async fn connect(&mut self) -> Result<()>;

    /// Disconnect from the data source.
    async fn disconnect(&mut self) -> Result<()>;

    // List all data sources in the specified namespace.
    async fn list_sources(&self, workspace_id: &Uuid) -> Result<Vec<String>>;

    // Returns a reference to self as a `dyn Any` to support downcasting.
    fn as_any(&self) -> &dyn Any;

    // By default, return None
    fn as_vector_connector(&self) -> Option<&dyn VectorConnector> {
        None
    }
}

// Trait for all vector-based geospatial data sources
#[async_trait]
pub trait VectorConnector: Connector {
    async fn get_geometry_type(&self, source_id: &Uuid) -> Result<GeometryType>;
    async fn create_namespace(&self, name: &str) -> Result<()>;
    async fn get_tile(&self, source_id: &Uuid, z: u32, x: u32, y: u32) -> Result<Vec<u8>>;
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
