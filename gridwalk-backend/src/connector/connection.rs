use super::{Connector, PostgisConnection, PostgisConnector};
use crate::{data::Database, Workspace};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use strum_macros::Display;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Display, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum ConnectionDetails {
    Postgis(PostgisConnection),
}

// TODO: Hold metadata such as region to optimize allocation to workspaces
// for connections with shared tenancy
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionConfig {
    pub id: Uuid,
    pub name: String,
    pub tenancy: ConnectionTenancy,
    pub config: ConnectionDetails,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub active: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionTenancy {
    Shared { capacity: usize },
    Workspace(Uuid),
}

impl ConnectionConfig {
    pub async fn create(self, database: &Arc<dyn Database>) -> Result<()> {
        // Test connection
        match &self.config {
            ConnectionDetails::Postgis(config) => {
                let mut connector = PostgisConnector::new(config.clone()).unwrap();
                connector.test_connection().await?;
            }
        }

        // TODO: Create new Error type for connection errors
        database.create_connection(&self).await?;
        Ok(())
    }

    pub async fn from_id(database: &Arc<dyn Database>, connection_id: &Uuid) -> Result<Self> {
        let con = database.get_connection(connection_id).await?;
        Ok(con)
    }

    // TODO: Delete connection (after handling all dependencies)
}

// Connections with workspace tenancy will only have a single WorkspaceConnectionAccess
// Connections with shared tenancy will have multiple WorkspaceConnectionAccess
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkspaceConnectionAccess {
    pub connection_id: Uuid,
    pub workspace_id: Uuid,
}

// The WorkspaceDataAccess struct is used to manage access to data between workspaces.
impl WorkspaceConnectionAccess {
    pub async fn save(&self, database: &Arc<dyn Database>) -> Result<()> {
        database.create_connection_access(&self).await?;
        Ok(())
    }

    pub async fn get_all(database: &Arc<dyn Database>, wsp: &Workspace) -> Result<Vec<Self>> {
        database.get_accessible_connections(wsp).await
    }

    // Get
    pub async fn get(database: &Arc<dyn Database>, wsp: &Workspace, con_id: &Uuid) -> Result<Self> {
        let con = database.get_accessible_connection(wsp, con_id).await?;
        Ok(con)
    }
}

//#[derive(Debug, Clone, Deserialize, Serialize)]
//pub enum ConnectionAccessConfig {
//    Admin(Uuid),
//    ReadWrite(Uuid),
//    ReadOnly(Uuid),
//}
//
//impl ConnectionAccessConfig {
//    pub fn from_str(variant: &str, workspace_id: &Uuid) -> Result<Self, String> {
//        match variant.to_lowercase().as_str() {
//            "admin" => Ok(ConnectionAccessConfig::Admin(*workspace_id)),
//            "readwrite" => Ok(ConnectionAccessConfig::ReadWrite(*workspace_id)),
//            "readonly" => Ok(ConnectionAccessConfig::ReadOnly(*workspace_id)),
//            _ => Err(format!("Invalid variant name: {}", variant)),
//        }
//    }
//
//    pub fn variant_name(&self) -> &'static str {
//        match self {
//            ConnectionAccessConfig::Admin(_) => "Admin",
//            ConnectionAccessConfig::ReadWrite(_) => "ReadWrite",
//            ConnectionAccessConfig::ReadOnly(_) => "ReadOnly",
//        }
//    }
//
//    pub fn workspace_id(&self) -> &Uuid {
//        match self {
//            ConnectionAccessConfig::Admin(v)
//            | ConnectionAccessConfig::ReadWrite(v)
//            | ConnectionAccessConfig::ReadOnly(v) => v,
//        }
//    }
//}

// The ActiveConnections struct and its impl block are used to manage live connections at runtime.
#[derive(Clone)]
pub struct ActiveConnections {
    sources: Arc<RwLock<HashMap<Uuid, Arc<dyn Connector>>>>,
}

impl ActiveConnections {
    pub fn new() -> Self {
        ActiveConnections {
            sources: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_connection(&self, connection: ConnectionConfig) {
        let mut sources = self.sources.write().await;
        // TODO: connect to the source
        let connector = match connection.config {
            ConnectionDetails::Postgis(config) => PostgisConnector::new(config).unwrap(),
        };
        sources.insert(connection.id, Arc::new(connector));
    }

    pub async fn get_connection(&self, connection_id: &Uuid) -> Result<Arc<dyn Connector>> {
        let sources = self.sources.read().await;
        sources
            .get(connection_id)
            .cloned()
            .ok_or_else(|| anyhow!("Source not found"))
    }

    pub async fn remove_connection(&self, id: &Uuid) -> Result<()> {
        let mut sources = self.sources.write().await;
        sources.remove(id);
        Ok(())
    }
}
