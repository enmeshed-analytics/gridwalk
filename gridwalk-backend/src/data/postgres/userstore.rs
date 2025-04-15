use super::base::Postgres;
use crate::data::UserStore;
use crate::{
    ConnectionAccess, ConnectionConfig, GlobalRole, User, Workspace, WorkspaceMember, WorkspaceRole,
};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use sqlx::encode::{Encode, IsNull};
use sqlx::postgres::{PgArgumentBuffer, PgRow, PgTypeInfo, PgValueRef};
use sqlx::{Decode, FromRow, Postgres as Pg, Row, Type};
use uuid::Uuid;
//use tracing::info;

impl Type<sqlx::Postgres> for GlobalRole {
    fn type_info() -> PgTypeInfo {
        // Represent GlobalRole as the same type as String (typically TEXT)
        <String as Type<sqlx::Postgres>>::type_info()
    }
}

impl<'r> Decode<'r, Pg> for GlobalRole {
    fn decode(value: PgValueRef<'r>) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // First, decode the value as a string slice.
        let s = <&str as Decode<Pg>>::decode(value)?;
        // Use your derived or implemented FromStr (or strum’s EnumString) to convert.
        s.parse().map_err(|_| "failed to decode GlobalRole".into())
    }
}

impl<'q> Encode<'q, Pg> for GlobalRole {
    fn encode_by_ref(
        &self,
        buf: &mut PgArgumentBuffer,
    ) -> Result<IsNull, Box<dyn std::error::Error + Send + Sync>> {
        // Convert self to its string representation using Display
        let s = self.to_string();
        // Propagate any error from the inner encode call
        <String as Encode<Pg>>::encode(s, buf)
    }
}

impl Type<sqlx::Postgres> for WorkspaceRole {
    fn type_info() -> PgTypeInfo {
        // Represent GlobalRole as the same type as String (typically TEXT)
        <String as Type<sqlx::Postgres>>::type_info()
    }
}

impl<'r> Decode<'r, Pg> for WorkspaceRole {
    fn decode(value: PgValueRef<'r>) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // First, decode the value as a string slice.
        let s = <&str as Decode<Pg>>::decode(value)?;
        // Use your derived or implemented FromStr (or strum’s EnumString) to convert.
        s.parse().map_err(|_| "failed to decode GlobalRole".into())
    }
}

impl<'q> Encode<'q, Pg> for WorkspaceRole {
    fn encode_by_ref(
        &self,
        buf: &mut PgArgumentBuffer,
    ) -> Result<IsNull, Box<dyn std::error::Error + Send + Sync>> {
        // Convert self to its string representation using Display
        let s = self.to_string();
        // Propagate any error from the inner encode call
        <String as Encode<Pg>>::encode(s, buf)
    }
}

impl<'r> FromRow<'r, PgRow> for User {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            email: row.try_get("email")?,
            first_name: row.try_get("first_name")?,
            last_name: row.try_get("last_name")?,
            global_role: row.try_get("global_role")?,
            active: row.try_get("active")?,
            created_at: row.try_get("created_at")?,
            hash: row.try_get("password_hash")?,
        })
    }
}

impl<'r> FromRow<'r, PgRow> for Workspace {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            active: row.try_get("active")?,
        })
    }
}

impl<'r> FromRow<'r, PgRow> for WorkspaceMember {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            workspace_id: row.try_get("workspace_id")?,
            user_id: row.try_get("user_id")?,
            role: row.try_get("role")?,
            joined_at: row.try_get("created_at")?,
        })
    }
}

impl<'r> FromRow<'r, PgRow> for ConnectionConfig {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        // Convert config from json to ConnectionConfig
        let config = row.try_get::<sqlx::types::Json<serde_json::Value>, _>("config")?;
        let config: crate::ConnectionDetails = serde_json::from_value(config.0)
            .map_err(|_| sqlx::Error::Decode("Failed to decode connection config".into()))?;

        let tenancy = row.try_get::<String, _>("tenancy")?;
        let tenancy = match tenancy.as_str() {
            "workspace" => crate::ConnectionTenancy::Workspace(row.try_get("workspace_id")?),
            "shared" => {
                // First, retrieve the shared_capacity as an i32.
                let capacity_i32: i32 = row.try_get("shared_capacity")?;
                // Attempt to convert it to usize safely.
                let capacity_usize: usize = capacity_i32.try_into().map_err(|_| {
                    sqlx::Error::Decode(
                        anyhow!("shared_capacity is negative and cannot be converted to usize")
                            .into(),
                    )
                })?;
                crate::ConnectionTenancy::Shared {
                    capacity: capacity_usize,
                }
            }
            _ => return Err(sqlx::Error::Decode(anyhow!("Invalid tenancy type").into())),
        };

        Ok(Self {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            config,
            tenancy,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            active: row.try_get("active")?,
        })
    }
}

impl<'r> FromRow<'r, PgRow> for ConnectionAccess {
    fn from_row(row: &'r PgRow) -> Result<Self, sqlx::Error> {
        let access_config = row.try_get::<String, _>("access_variant")?;
        let access_path = row.try_get::<String, _>("access_path")?;
        let access_config = crate::ConnectionAccessConfig::from_str(&access_config, access_path)
            .map_err(|_| {
                sqlx::Error::Decode(anyhow!("Failed to decode connection access").into())
            })?;

        Ok(Self {
            connection_id: row.try_get("connection_id")?,
            workspace_id: row.try_get("workspace_id")?,
            access_config,
        })
    }
}

#[async_trait]
impl UserStore for Postgres {
    async fn create_user(&self, user: &User) -> Result<()> {
        let query =
            "INSERT INTO users (id, email, password_hash, global_role) VALUES ($1, $2, $3, $4)";
        let result = sqlx::query(&query)
            .bind(&user.id)
            .bind(&user.email)
            .bind(&user.hash)
            .bind(&user.global_role)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Failed to create user."));
        }

        Ok(())
    }

    async fn get_user_by_email(&self, email: &str) -> Result<User> {
        let query = "SELECT * FROM users WHERE email = $1";
        sqlx::query_as::<_, User>(query)
            .bind(email)
            .fetch_one(&self.pool)
            .await?;
    }

    async fn get_user_by_id(&self, id: &str) -> Result<User> {
        let query = "SELECT * FROM users WHERE id = $1";
        sqlx::query_as::<_, User>(query)
            .bind(id)
            .fetch_one(&self.pool)
            .await?;
    }

    async fn create_workspace(&self, wsp: &Workspace, admin: &User) -> Result<()> {
        let mut transaction = self.pool.begin().await?;
        let workspace_query = "INSERT INTO workspaces (id, name) VALUES ($1, $2)";
        let workspace_result = sqlx::query(&workspace_query)
            .bind(&wsp.id)
            .bind(&wsp.name)
            .execute(&mut *transaction)
            .await?;

        if workspace_result.rows_affected() == 0 {
            return Err(anyhow!("Failed to create workspace."));
        }

        let member_query =
            "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)";

        sqlx::query(&member_query)
            .bind(&wsp.id)
            .bind(&admin.id)
            .bind(WorkspaceRole::Admin.to_string())
            .execute(&mut *transaction)
            .await?;

        transaction.commit().await?;

        Ok(())
    }

    async fn delete_workspace(&self, wsp: &Workspace) -> Result<()> {
        let query = "DELETE FROM workspaces WHERE id = $1";
        let result = sqlx::query(&query)
            .bind(&wsp.id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Failed to delete workspace."));
        }

        Ok(())
    }

    async fn get_workspace_by_id(&self, id: &str) -> Result<Workspace> {
        let query = "SELECT * FROM workspaces WHERE id = $1";
        sqlx::query_as::<_, Workspace>(query)
            .bind(id)
            .fetch_one(&self.pool)
            .await?;
    }

    async fn add_workspace_member(
        &self,
        wsp: &Workspace,
        user: &User,
        role: WorkspaceRole,
    ) -> Result<()> {
        let query =
            "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)";
        let result = sqlx::query(&query)
            .bind(&wsp.id)
            .bind(&user.id)
            .bind(role.to_string())
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Failed to add workspace member."));
        }

        Ok(())
    }

    async fn get_workspace_member(&self, wsp: &Workspace, user: &User) -> Result<WorkspaceMember> {
        let query = "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2";
        sqlx::query_as::<_, WorkspaceMember>(query)
            .bind(&wsp.id)
            .bind(&user.id)
            .fetch_one(&self.pool)
            .await?;
    }

    async fn get_workspace_members(&self, wsp: &Workspace) -> Result<Vec<WorkspaceMember>> {
        let query = "SELECT * FROM workspace_members WHERE workspace_id = $1";
        sqlx::query_as::<_, WorkspaceMember>(query)
            .bind(&wsp.id)
            .fetch_all(&self.pool)
            .await?;
    }

    async fn remove_workspace_member(&self, org: &Workspace, user: &User) -> Result<()> {
        let query = "DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2";
        let result = sqlx::query(&query)
            .bind(&org.id)
            .bind(&user.id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Failed to remove workspace member."));
        }

        Ok(())
    }

    async fn create_connection(&self, connection: &ConnectionConfig) -> Result<()> {
        let tenancy = connection.tenancy.clone();
        let tenancy_str = match &tenancy {
            crate::ConnectionTenancy::Workspace(_) => "workspace",
            crate::ConnectionTenancy::Shared { .. } => "shared",
        };
        // Workspace ID is not None if tenancy is set to workspace
        let workspace_id = match tenancy {
            crate::ConnectionTenancy::Workspace(id) => Some(id),
            crate::ConnectionTenancy::Shared { capacity: _ } => None,
        };
        // The capacity is not None if tenancy is set to shared
        let shared_capacity = match tenancy {
            crate::ConnectionTenancy::Workspace(_) => None,
            crate::ConnectionTenancy::Shared { capacity } => Some(capacity),
        };

        let query = "INSERT INTO connections (id, name, tenancy, shared_capacity, workspace_id, config) VALUES ($1, $2, $3, $4)";
        let result = sqlx::query(&query)
            .bind(&connection.id)
            .bind(&connection.name)
            .bind(tenancy_str)
            .bind(shared_capacity.map(|cap| cap as i32))
            .bind(workspace_id)
            .bind(sqlx::types::Json(&connection.config))
            .execute(&self.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(anyhow!("Failed to create connection."));
        }
        Ok(())
    }

    async fn get_connection(&self, connection_id: &Uuid) -> Result<ConnectionConfig> {
        let query = "SELECT * FROM connections WHERE id = $1";
        sqlx::query_as::<_, ConnectionConfig>(query)
            .bind(connection_id)
            .fetch_one(&self.pool)
            .await?;
    }

    async fn create_connection_access(&self, ca: &ConnectionAccess) -> Result<()> {
        let query = "INSERT INTO connection_access (workspace_id, connection_id, access_path, access_variant) VALUES ($1, $2, $3, $4)";
        let result = sqlx::query(&query)
            .bind(&ca.connection_id)
            .bind(&ca.workspace_id)
            .bind(&ca.access_config.path())
            .bind(&ca.access_config.variant_name())
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Failed to create connection access."));
        }

        Ok(())
    }

    async fn get_accessible_connections(&self, wsp: &Workspace) -> Result<Vec<ConnectionAccess>> {
        let query = "SELECT * FROM connection_access WHERE workspace_id = $1";
        sqlx::query_as::<_, ConnectionAccess>(query)
            .bind(&wsp.id)
            .fetch_all(&self.pool)
            .await?;
    }

    async fn get_accessible_connection(
        &self,
        wsp: &Workspace,
        con_id: &Uuid,
    ) -> Result<ConnectionAccess> {
        let query =
            "SELECT * FROM connection_access WHERE workspace_id = $1 AND connection_id = $2";
        sqlx::query_as::<_, ConnectionAccess>(query)
            .bind(&wsp.id)
            .bind(con_id)
            .fetch_one(&self.pool)
            .await?;
    }

    async fn create_layer_record(&self, layer: &crate::Layer, uploaded_by: &User) -> Result<()> {
        let query =
            "INSERT INTO layers (id, name, workspace_id, connection_id, uploaded_by) VALUES ($1, $2, $3, $4, $5)";
        let result = sqlx::query(&query)
            .bind(&layer.id)
            .bind(&layer.name)
            .bind(&layer.workspace_id)
            .bind(&layer.connection_id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(anyhow!("Failed to create layer record."));
        }

        Ok(())
    }
}
