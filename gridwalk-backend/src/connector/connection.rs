use super::{Connector, PostgisConnection, PostgisConnector};
use crate::Workspace;
use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgRow;
use sqlx::{FromRow, Row};
use std::sync::Arc;
use strum_macros::Display;
use tracing::error;
use uuid::Uuid;

#[derive(Debug, Clone, Display, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum ConnectionTenancy {
    Shared { capacity: usize },
    Workspace(Uuid),
}

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

impl<'r> FromRow<'r, PgRow> for ConnectionConfig {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        // Extract each field from the row
        // Refresh token may be null, so we need to handle it as an Option
        let tenancy_str: String = row.try_get("tenancy")?;
        let tenancy = match tenancy_str.as_str() {
            "workspace" => {
                let workspace_id: Uuid = row.try_get("workspace_id")?;
                ConnectionTenancy::Workspace(workspace_id)
            }
            "shared" => {
                let shared_capacity: Option<i32> = row.try_get("shared_capacity")?;
                ConnectionTenancy::Shared {
                    capacity: shared_capacity.unwrap_or(1) as usize,
                }
            }
            _ => return Err(sqlx::Error::Decode(anyhow!("Unknown tenancy type").into())),
        };
        let connector_type: String = row.try_get("connector_type")?;
        let config_json: serde_json::Value = row.try_get("config")?;
        let created_at: DateTime<Utc> = row.try_get("created_at")?;
        let updated_at: DateTime<Utc> = row.try_get("updated_at")?;

        // Construct the Session struct
        Ok(Self {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            tenancy,
            config: match connector_type.as_str() {
                "postgis" => {
                    let postgis_config: PostgisConnection = serde_json::from_value(config_json)
                        .map_err(|e| sqlx::Error::Decode(Box::new(e)))?;
                    ConnectionDetails::Postgis(postgis_config)
                }
                _ => {
                    return Err(sqlx::Error::Decode(
                        anyhow!("Unknown connector type").into(),
                    ))
                }
            },
            created_at,
            updated_at,
            active: row.try_get("active")?,
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConnectionCapacityInfo {
    pub connection_id: Uuid,
    pub capacity: usize,
    pub usage_count: usize,
}

impl ConnectionConfig {
    // Used to remove sensitive data from the connection config
    pub fn sanitize(mut self) -> Self {
        match &mut self.config {
            ConnectionDetails::Postgis(postgis) => {
                postgis.sanitize();
            }
        }
        self
    }

    pub async fn save<'e, E>(&self, executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let tenancy_str = match &self.tenancy {
            crate::ConnectionTenancy::Workspace(_) => "workspace",
            crate::ConnectionTenancy::Shared { .. } => "shared",
        };
        // Workspace ID is not None if tenancy is set to workspace
        let workspace_id = match &self.tenancy {
            crate::ConnectionTenancy::Workspace(id) => Some(id),
            crate::ConnectionTenancy::Shared { capacity: _ } => None,
        };
        // The capacity is not None if tenancy is set to shared
        let shared_capacity = match &self.tenancy {
            crate::ConnectionTenancy::Workspace(_) => None,
            crate::ConnectionTenancy::Shared { capacity } => Some(capacity).map(|c| *c as i32),
        };

        let config_json =
            serde_json::to_value(&self.config).map_err(|e| sqlx::Error::Decode(Box::new(e)))?;

        let query = "
            INSERT INTO connections (id, name, tenancy, shared_capacity, workspace_id, connector_type, config, active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)";

        sqlx::query(query)
            .bind(&self.id)
            .bind(&self.name)
            .bind(tenancy_str)
            .bind(shared_capacity)
            .bind(workspace_id)
            .bind("postgis") // Currently only Postgis is supported
            .bind(config_json)
            .bind(self.active)
            .execute(executor)
            .await?;

        Ok(())
    }

    pub async fn from_id(pool: &sqlx::PgPool, connection_id: &Uuid) -> Result<Self, sqlx::Error> {
        let query = "SELECT * FROM connections WHERE id = $1";
        let connection = sqlx::query_as::<_, ConnectionConfig>(query)
            .bind(connection_id)
            .fetch_one(pool)
            .await?;

        Ok(connection.sanitize())
    }

    pub async fn get_all(pool: &sqlx::PgPool) -> Result<Vec<Self>, sqlx::Error> {
        let query = "SELECT * FROM connections";
        let connections = sqlx::query_as::<_, ConnectionConfig>(query)
            .fetch_all(pool)
            .await?;

        Ok(connections.into_iter().map(|c| c.sanitize()).collect())
    }

    pub async fn capacity_info(
        &self,
        pool: &sqlx::PgPool,
    ) -> Result<ConnectionCapacityInfo, sqlx::Error> {
        let capacity = match &self.tenancy {
            ConnectionTenancy::Shared { capacity } => *capacity,
            ConnectionTenancy::Workspace(_) => 1,
        };

        let usage_query = "SELECT COUNT(*) FROM connection_access WHERE connection_id = $1";
        let usage_count: i64 = sqlx::query_scalar(usage_query)
            .bind(&self.id)
            .fetch_one(pool)
            .await?;

        Ok(ConnectionCapacityInfo {
            connection_id: self.id,
            capacity,
            usage_count: usage_count as usize,
        })
    }

    // Find connections with shared tenancy that have spare capacity
    pub async fn get_shared_with_spare_capacity(
        pool: &sqlx::PgPool,
    ) -> Result<Vec<ConnectionCapacityInfo>, sqlx::Error> {
        let query = "
            SELECT id, name, tenancy, shared_capacity, workspace_id, connector_type, config, active
            FROM connections
            WHERE tenancy = 'shared' AND active = true";

        let connections = sqlx::query_as::<_, ConnectionConfig>(query)
            .fetch_all(pool)
            .await?;

        let mut results = Vec::new();
        for connection in connections {
            let capacity_info = connection.capacity_info(&pool).await?;
            if capacity_info.usage_count < capacity_info.capacity {
                results.push(capacity_info);
            }
        }

        Ok(results)
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

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for WorkspaceConnectionAccess {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            connection_id: row.try_get("connection_id")?,
            workspace_id: row.try_get("workspace_id")?,
        })
    }
}

// The WorkspaceDataAccess struct is used to manage access to data between workspaces.
impl WorkspaceConnectionAccess {
    pub fn new(connection_id: Uuid, workspace_id: Uuid) -> Self {
        Self {
            connection_id,
            workspace_id,
        }
    }

    pub async fn save<'e, E>(&self, executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "
            INSERT INTO workspace_connection_access (workspace_id, connection_id)
            VALUES ($1, $2)";

        sqlx::query(query)
            .bind(&self.workspace_id)
            .bind(&self.connection_id)
            .execute(executor)
            .await?;

        Ok(())
    }

    pub async fn get_all<'e, E>(
        executor: E,
        wsp: &Workspace,
    ) -> Result<Vec<ConnectionConfig>, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "
            SELECT c.* FROM connections c
            JOIN workspace_connection_access wca ON c.id = wca.connection_id
            WHERE wca.workspace_id = $1";
        let connections = sqlx::query_as::<_, ConnectionConfig>(query)
            .bind(&wsp.id)
            .fetch_all(executor)
            .await?;

        Ok(connections)
    }

    pub async fn get<'e, E>(
        executor: E,
        wsp: &Workspace,
        con_id: &Uuid,
    ) -> Result<Self, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "
            SELECT * FROM workspace_connection_access
            WHERE workspace_id = $1 AND connection_id = $2";
        let row = sqlx::query_as::<_, WorkspaceConnectionAccess>(query)
            .bind(&wsp.id)
            .bind(con_id)
            .fetch_one(executor)
            .await?;
        Ok(row)
    }
}

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

impl ActiveConnections {
    pub fn new() -> Self {
        Self {
            sources: DashMap::new(),
        }
    }

    pub async fn load_connection(
        &self,
        connection: ConnectionConfig,
    ) -> Result<(), ActiveConnectionError> {
        let connector: Arc<dyn Connector + Send + Sync> = match connection.config {
            ConnectionDetails::Postgis(cfg) => match PostgisConnector::new(cfg) {
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
            .ok_or_else(|| ActiveConnectionError::NotFound { id: *id })
    }

    pub fn remove_connection(&self, id: &Uuid) -> Result<(), ActiveConnectionError> {
        self.sources
            .remove(id)
            .map(|_| ())
            .ok_or_else(|| ActiveConnectionError::NotFound { id: *id })
    }
}
