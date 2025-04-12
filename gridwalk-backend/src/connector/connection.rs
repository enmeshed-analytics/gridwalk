use super::Connector;
use crate::{data::Database, Workspace};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionConfig {
    pub id: Uuid,
    pub name: String,
    pub tenancy: ConnectionTenancy,
    pub config: Connector,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub active: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionTenancy {
    Shared,
    Workspace(Uuid),
}

impl ConnectionConfig {
    pub async fn create_record(self, database: &Arc<dyn Database>) -> Result<()> {
        database.create_connection(&self).await?;
        Ok(())
    }

    pub async fn from_name(database: &Arc<dyn Database>, connection_name: &str) -> Result<Self> {
        let con = database.get_connection(connection_name).await?;
        Ok(con)
    }

    // TODO: Delete connection (after handling all dependencies)
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionAccess {
    pub connection_id: Uuid,
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

    pub async fn get(database: &Arc<dyn Database>, wsp: &Workspace, con_id: &Uuid) -> Result<Self> {
        let con = database.get_accessible_connection(wsp, con_id).await?;
        Ok(con)
    }
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

// The ActiveConnections struct and its impl block are used to manage live connections at runtime.
#[derive(Clone)]
pub struct ActiveConnections {
    sources: Arc<RwLock<HashMap<Uuid, Arc<Connector>>>>,
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
        sources.insert(connection.id, Arc::new(connection.config));
    }

    pub async fn get_connection(&self, connection_id: &Uuid) -> Result<Arc<Connector>> {
        let sources = self.sources.read().await;
        sources
            .get(connection_id)
            .cloned()
            .ok_or_else(|| anyhow!("Source not found"))
    }

    pub async fn remove_connection(&self, id: &Uuid) -> Option<Arc<Connector>> {
        let mut sources = self.sources.write().await;
        sources.remove(id)
    }
}
