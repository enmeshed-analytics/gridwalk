use crate::connector::PostgisConnection;
use crate::Workspace;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgRow;
use sqlx::{FromRow, Row};
use strum_macros::Display;
use uuid::Uuid;

#[derive(Debug, Clone, Display, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum DataStoreTenancy {
    Shared { capacity: usize },
    Workspace(Uuid),
}

#[derive(Debug, Display, Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum DataStoreDetails {
    Postgis(PostgisConnection),
}

// TODO: Hold metadata such as region to optimize allocation to workspaces
// for connections with shared tenancy
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DataStoreConfig {
    pub id: Uuid,
    pub name: String,
    pub tenancy: DataStoreTenancy,
    pub config: DataStoreDetails,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub active: bool,
}

impl<'r> FromRow<'r, PgRow> for DataStoreConfig {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        // Extract each field from the row
        // Refresh token may be null, so we need to handle it as an Option
        let tenancy_str: String = row.try_get("tenancy")?;
        let tenancy = match tenancy_str.as_str() {
            "workspace" => {
                let workspace_id: Uuid = row.try_get("workspace_id")?;
                DataStoreTenancy::Workspace(workspace_id)
            }
            "shared" => {
                let shared_capacity: Option<i32> = row.try_get("shared_capacity")?;
                DataStoreTenancy::Shared {
                    capacity: shared_capacity.unwrap_or(1) as usize,
                }
            }
            _ => return Err(sqlx::Error::Decode("Unknown tenancy type".into())),
        };
        let connector_type: String = row.try_get("connector_type")?;
        let config_json: serde_json::Value = row.try_get("config")?;
        let config = match connector_type.as_str() {
            "postgis" => {
                let config_json = config_json
                    .as_object()
                    .ok_or_else(|| sqlx::Error::Decode("Invalid config JSON".into()))?;

                // Extract the nested "postgis" configuration
                let postgis_config_json = config_json
                    .get("postgis")
                    .ok_or_else(|| sqlx::Error::Decode("Missing postgis config".into()))?;

                let postgis_config: PostgisConnection =
                    serde_json::from_value(postgis_config_json.clone())
                        .map_err(|e| sqlx::Error::Decode(Box::new(e)))?;
                DataStoreDetails::Postgis(postgis_config)
            }
            _ => return Err(sqlx::Error::Decode("Unknown connector type".into())),
        };
        let created_at: DateTime<Utc> = row.try_get("created_at")?;
        let updated_at: DateTime<Utc> = row.try_get("updated_at")?;

        // Construct the Session struct
        Ok(Self {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            tenancy,
            config,
            created_at,
            updated_at,
            active: row.try_get("active")?,
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DataStoreCapacityInfo {
    pub connection_id: Uuid,
    pub capacity: usize,
    pub usage_count: usize,
}

impl DataStoreConfig {
    // Used to remove sensitive data from the connection config
    pub fn sanitize(mut self) -> Self {
        match &mut self.config {
            DataStoreDetails::Postgis(postgis) => {
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
            crate::DataStoreTenancy::Workspace(_) => "workspace",
            crate::DataStoreTenancy::Shared { .. } => "shared",
        };
        // Workspace ID is not None if tenancy is set to workspace
        let workspace_id = match &self.tenancy {
            crate::DataStoreTenancy::Workspace(id) => Some(id),
            crate::DataStoreTenancy::Shared { capacity: _ } => None,
        };
        // The capacity is not None if tenancy is set to shared
        let shared_capacity = match &self.tenancy {
            crate::DataStoreTenancy::Workspace(_) => None,
            crate::DataStoreTenancy::Shared { capacity } => Some(capacity).map(|c| *c as i32),
        };

        let config_json =
            serde_json::to_value(&self.config).map_err(|e| sqlx::Error::Decode(Box::new(e)))?;

        let query = "
            INSERT INTO gridwalk.connections (id, name, tenancy, shared_capacity, workspace_id, connector_type, config, active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)";

        sqlx::query(query)
            .bind(self.id)
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

    pub async fn from_id<'e, E>(executor: E, connection_id: &Uuid) -> Result<Self, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT * FROM gridwalk.connections WHERE id = $1";
        let connection = sqlx::query_as::<_, DataStoreConfig>(query)
            .bind(connection_id)
            .fetch_one(executor)
            .await?;

        Ok(connection.sanitize())
    }

    pub async fn get_all<'e, E>(executor: E) -> Result<Vec<Self>, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT * FROM gridwalk.connections";
        let connections = sqlx::query_as::<_, DataStoreConfig>(query)
            .fetch_all(executor)
            .await?;

        Ok(connections.into_iter().map(|c| c.sanitize()).collect())
    }

    pub async fn capacity_info<'e, E>(
        &self,
        executor: E,
    ) -> Result<DataStoreCapacityInfo, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let capacity = match &self.tenancy {
            DataStoreTenancy::Shared { capacity } => *capacity,
            DataStoreTenancy::Workspace(_) => 1,
        };

        let usage_query =
            "SELECT COUNT(*) FROM gridwalk.connection_access WHERE connection_id = $1";
        let usage_count: i64 = sqlx::query_scalar(usage_query)
            .bind(self.id)
            .fetch_one(executor)
            .await?;

        Ok(DataStoreCapacityInfo {
            connection_id: self.id,
            capacity,
            usage_count: usage_count as usize,
        })
    }

    // Find connections with shared tenancy that have spare capacity
    pub async fn get_shared_with_spare_capacity<'e, E>(
        executor: E,
    ) -> Result<Vec<DataStoreCapacityInfo>, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e> + std::marker::Copy,
    {
        let query = "
            SELECT *
            FROM gridwalk.connections
            WHERE tenancy = 'shared' AND active = true";

        let connections = sqlx::query_as::<_, DataStoreConfig>(query)
            .fetch_all(executor)
            .await?;

        let mut results = Vec::new();
        for connection in connections {
            let capacity_info = connection.capacity_info(executor).await?;
            if capacity_info.usage_count < capacity_info.capacity {
                results.push(capacity_info);
            }
        }

        Ok(results)
    }
    // TODO: Delete connection (after handling all dependencies)
}

// Data Stores with workspace tenancy will only have a single WorkspaceDataStoreAccess
// Data Stores with shared tenancy will have multiple WorkspaceDataStoreAccess
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkspaceDataStoreAccess {
    pub connection_id: Uuid,
    pub workspace_id: Uuid,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for WorkspaceDataStoreAccess {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            connection_id: row.try_get("connection_id")?,
            workspace_id: row.try_get("workspace_id")?,
        })
    }
}

// The WorkspaceDataAccess struct is used to manage access to data between workspaces.
impl WorkspaceDataStoreAccess {
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
            INSERT INTO gridwalk.connection_access (workspace_id, connection_id)
            VALUES ($1, $2)";

        sqlx::query(query)
            .bind(self.workspace_id)
            .bind(self.connection_id)
            .execute(executor)
            .await?;

        Ok(())
    }

    pub async fn get_all<'e, E>(
        executor: E,
        workspace: &Workspace,
    ) -> Result<Vec<DataStoreConfig>, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "
            SELECT c.* FROM gridwalk.connections c
            JOIN gridwalk.connection_access wca ON c.id = wca.connection_id
            WHERE wca.workspace_id = $1";
        let connections = sqlx::query_as::<_, DataStoreConfig>(query)
            .bind(workspace.id)
            .fetch_all(executor)
            .await?;

        Ok(connections)
    }

    pub async fn get<'e, E>(
        executor: E,
        workspace: &Workspace,
        connection_id: &Uuid,
    ) -> Result<Self, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "
            SELECT * FROM gridwalk.connection_access
            WHERE workspace_id = $1 AND connection_id = $2";
        let row = sqlx::query_as::<_, WorkspaceDataStoreAccess>(query)
            .bind(workspace.id)
            .bind(connection_id)
            .fetch_one(executor)
            .await?;
        Ok(row)
    }
}
