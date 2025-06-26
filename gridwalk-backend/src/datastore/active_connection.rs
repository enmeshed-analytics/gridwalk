use super::{DataStoreConfig, DataStoreDetails};
use crate::connector::{Connector, PostgisConnector};
use dashmap::DashMap;
use std::sync::Arc;
use tracing::error;
use uuid::Uuid;

// The ActiveConnections struct and its impl block are used to manage live connections at runtime.
#[derive(Clone)]
pub struct ActiveConnections {
    sources: DashMap<Uuid, Arc<dyn Connector + Send + Sync>>,
}

#[derive(Debug, thiserror::Error)]
pub enum ActiveConnectionError {
    #[error("Connection not found: {id}")]
    NotFound { id: Uuid },
    #[error("Failed to create connector")]
    ConnectorCreation,
}

impl Default for ActiveConnections {
    fn default() -> Self {
        Self::new()
    }
}

impl ActiveConnections {
    pub fn new() -> Self {
        Self {
            sources: DashMap::new(),
        }
    }

    pub async fn load_connection(
        &self,
        connection: DataStoreConfig,
    ) -> Result<(), ActiveConnectionError> {
        let connector: Arc<dyn Connector + Send + Sync> = match connection.config {
            DataStoreDetails::Postgis(cfg) => match PostgisConnector::new(cfg) {
                Ok(connector) => Arc::new(connector),
                Err(e) => {
                    error!("Failed to create Postgis connector: {}", e);
                    return Err(ActiveConnectionError::ConnectorCreation);
                }
            },
        };

        // TODO: connect to the source
        self.sources.insert(connection.id, connector);
        Ok(())
    }

    pub fn get_connection(
        &self,
        id: &Uuid,
    ) -> Result<Arc<dyn Connector + Send + Sync>, ActiveConnectionError> {
        self.sources
            .get(id)
            .map(|entry| entry.clone())
            .ok_or(ActiveConnectionError::NotFound { id: *id })
    }

    pub fn remove_connection(&self, id: &Uuid) -> Result<(), ActiveConnectionError> {
        self.sources
            .remove(id)
            .map(|_| ())
            .ok_or(ActiveConnectionError::NotFound { id: *id })
    }
}
