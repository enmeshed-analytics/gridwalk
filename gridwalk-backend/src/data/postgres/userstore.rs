use super::base::Postgres;
use crate::data::UserStore;
use crate::{
    ConnectionConfig, GlobalRole, User, Workspace, WorkspaceConnectionAccess, WorkspaceMember,
    WorkspaceRole,
};
use anyhow::{anyhow, Error as AnyhowError, Result};
use async_trait::async_trait;
use bytes::BytesMut;
use std::convert::TryFrom;
use std::error::Error;
use tokio_postgres::types::{FromSql, IsNull, ToSql, Type};
use tokio_postgres::{Error as PgError, Row};
use uuid::Uuid;

impl<'a> FromSql<'a> for GlobalRole {
    // Tell tokio-postgres which SQL types we accept
    fn accepts(ty: &Type) -> bool {
        // you can also use Type::VARCHAR if you prefer
        ty == &Type::VARCHAR
    }

    // Convert the raw bytes from Postgres into your enum
    fn from_sql(ty: &Type, raw: &'a [u8]) -> Result<Self, Box<dyn Error + Sync + Send>> {
        // type‐check
        if !<GlobalRole as FromSql<'a>>::accepts(ty) {
            return Err(format!("cannot convert SQL type {:?} to GlobalRole", ty).into());
        }
        // Convert the raw bytes into a UTF-8 string
        let s = std::str::from_utf8(raw)?;

        // Then let strum do the parsing from snake_case into your variant
        s.parse::<GlobalRole>()
            .map_err(|_| format!("invalid GlobalRole `{}`", s).into())
    }
}

impl ToSql for GlobalRole {
    /// Which SQL types we can serialize into
    fn accepts(ty: &Type) -> bool {
        ty == &Type::TEXT || ty == &Type::VARCHAR
    }

    /// The “unchecked” serializer
    fn to_sql(
        &self,
        ty: &Type,
        buf: &mut BytesMut,
    ) -> Result<IsNull, Box<dyn Error + Sync + Send>> {
        // Make sure the caller really passed a TEXT
        if !<GlobalRole as ToSql>::accepts(ty) {
            return Err(format!("cannot convert GlobalRole to SQL type {:?}", ty).into());
        }

        // “super” / “support” / “read”
        let s = self.to_string();
        // Delegate to the existing &str → SQL impl
        <&str as ToSql>::to_sql(&s.as_str(), &Type::TEXT, buf)
    }

    /// The “checked” entry point the compiler now demands
    fn to_sql_checked(
        &self,
        ty: &Type,
        buf: &mut BytesMut,
    ) -> Result<IsNull, Box<dyn Error + Sync + Send>> {
        // Only serialize if the type is one we accept:
        if !<GlobalRole as ToSql>::accepts(ty) {
            return Err(format!("cannot convert GlobalRole to SQL type {:?}", ty).into());
        }
        // Otherwise just call our normal to_sql
        self.to_sql(ty, buf)
    }
}

impl TryFrom<&Row> for User {
    type Error = PgError;

    fn try_from(row: &Row) -> Result<Self, PgError> {
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

impl TryFrom<&Row> for Workspace {
    type Error = PgError;

    fn try_from(row: &Row) -> Result<Self, PgError> {
        Ok(Self {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            active: row.try_get("active")?,
        })
    }
}

impl FromSql<'_> for WorkspaceRole {
    fn accepts(ty: &Type) -> bool {
        ty == &Type::TEXT
    }

    fn from_sql(ty: &Type, raw: &[u8]) -> Result<Self, Box<dyn Error + Sync + Send>> {
        if !Self::accepts(ty) {
            return Err(format!("cannot convert SQL type {:?} to WorkspaceRole", ty).into());
        }
        let s = std::str::from_utf8(raw)?;
        s.parse::<WorkspaceRole>()
            .map_err(|_| format!("invalid WorkspaceRole `{}`", s).into())
    }
}

impl TryFrom<&Row> for WorkspaceMember {
    type Error = PgError;

    fn try_from(row: &Row) -> Result<Self, PgError> {
        Ok(Self {
            workspace_id: row.try_get("workspace_id")?,
            user_id: row.try_get("user_id")?,
            role: row.try_get("role")?,
            joined_at: row.try_get("created_at")?,
        })
    }
}

impl TryFrom<&Row> for crate::Layer {
    type Error = PgError;

    fn try_from(row: &Row) -> Result<Self, PgError> {
        Ok(Self {
            id: row.try_get("id")?,
            workspace_id: row.try_get("workspace_id")?,
            connection_id: row.try_get("connection_id")?,
            name: row.try_get("name")?,
            uploaded_by: row.try_get("uploaded_by")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

impl TryFrom<&Row> for crate::Project {
    type Error = PgError;

    fn try_from(row: &Row) -> Result<Self, PgError> {
        Ok(Self {
            id: row.try_get("id")?,
            workspace_id: row.try_get("workspace_id")?,
            name: row.try_get("name")?,
            owner_id: row.try_get("owner")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

impl<'c> FromSql<'c> for crate::ConnectionDetails {
    fn accepts(ty: &Type) -> bool {
        ty == &Type::JSONB
    }

    fn from_sql(_ty: &Type, raw: &'c [u8]) -> Result<Self, Box<dyn Error + Sync + Send>> {
        // decode from UTF‑8
        let s = std::str::from_utf8(raw)?;
        // parse the JSON into our enum
        let config = serde_json::from_str::<crate::ConnectionDetails>(s)?;
        Ok(config)
    }
}

impl TryFrom<&Row> for crate::ConnectionConfig {
    type Error = AnyhowError;

    fn try_from(row: &Row) -> Result<Self, AnyhowError> {
        let tenancy: String = row.try_get("tenancy")?;
        let tenancy = match tenancy.as_str() {
            "workspace" => crate::ConnectionTenancy::Workspace(row.try_get("workspace_id")?),
            "shared" => {
                let capacity: i32 = row.try_get("shared_capacity")?;
                let capacity: usize = capacity.try_into().map_err(|_| {
                    anyhow!("shared_capacity is negative and cannot be converted to usize")
                })?;
                crate::ConnectionTenancy::Shared { capacity }
            }
            other => return Err(anyhow::anyhow!("Invalid tenancy type: {}", other).into()),
        };

        Ok(Self {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            config: row.try_get("config")?,
            tenancy,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            active: row.try_get("active")?,
        })
    }
}

impl TryFrom<&Row> for crate::WorkspaceConnectionAccess {
    type Error = PgError;

    fn try_from(row: &Row) -> Result<Self, PgError> {
        Ok(Self {
            connection_id: row.try_get("connection_id")?,
            workspace_id: row.try_get("workspace_id")?,
        })
    }
}

#[async_trait]
impl UserStore for Postgres {
    async fn create_user(&self, user: &User) -> Result<()> {
        let client = self.pool.get().await?;
        let rows_inserted = client
            .execute(
                "INSERT INTO users (id, email, first_name, last_name, password_hash, global_role) VALUES ($1, $2, $3, $4, $5, $6)",
                &[&user.id, &user.email, &user.first_name, &user.last_name, &user.hash, &user.global_role],
            )
            .await?;

        if rows_inserted == 0 {
            return Err(anyhow!("Failed to create user."));
        }

        Ok(())
    }

    async fn get_user_by_email(&self, email: &str) -> Result<User> {
        let client = self.pool.get().await?;
        let row = client
            .query_one("SELECT * FROM users WHERE email = $1", &[&email])
            .await?;
        User::try_from(&row).map_err(|_| anyhow!("Failed to get user with email: {}", email))
    }

    async fn get_user_by_id(&self, id: &Uuid) -> Result<User> {
        let client = self.pool.get().await?;
        let row = client
            .query_one("SELECT * FROM users WHERE id = $1", &[&id])
            .await?;
        User::try_from(&row).map_err(|_| anyhow!("Failed to get user with ID: {}", id))
    }

    async fn create_workspace(&self, wsp: &Workspace, admin: &User) -> Result<()> {
        let mut client = self.pool.get().await?;
        let transaction = client.transaction().await?;
        let workspace_rows_inserted = transaction
            .execute(
                "INSERT INTO workspaces (id, name) VALUES ($1, $2)",
                &[&wsp.id, &wsp.name],
            )
            .await?;

        if workspace_rows_inserted == 0 {
            return Err(anyhow!("Failed to create workspace."));
        }

        let member_rows_inserted = transaction
            .execute(
                "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)",
                &[&wsp.id, &admin.id, &WorkspaceRole::Admin.to_string()],
            )
            .await?;

        if member_rows_inserted == 0 {
            return Err(anyhow!("Failed to add admin to workspace."));
        }

        transaction.commit().await?;
        Ok(())
    }

    async fn delete_workspace(&self, wsp: &Workspace) -> Result<()> {
        let client = self.pool.get().await?;
        let rows_affected = client
            .execute("DELETE FROM workspaces WHERE id = $1", &[&wsp.id])
            .await?;

        if rows_affected == 0 {
            return Err(anyhow!("Failed to delete workspace."));
        }

        Ok(())
    }

    async fn get_workspace_by_id(&self, id: &Uuid) -> Result<Workspace> {
        let client = self.pool.get().await?;
        let row = client
            .query_one("SELECT * FROM workspaces WHERE id = $1", &[&id])
            .await?;
        Workspace::try_from(&row).map_err(|_| anyhow!("Failed to get workspace with ID: {}", id))
    }

    async fn add_workspace_member(
        &self,
        wsp: &Workspace,
        user: &User,
        role: WorkspaceRole,
    ) -> Result<()> {
        let client = self.pool.get().await?;
        let rows_affected = client
            .execute(
                "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)",
                &[&wsp.id, &user.id, &role.to_string()],
            )
            .await?;
        if rows_affected == 0 {
            return Err(anyhow!("Failed to add workspace member."));
        }
        Ok(())
    }

    async fn get_workspace_member(&self, wsp: &Workspace, user: &User) -> Result<WorkspaceMember> {
        let client = self.pool.get().await?;
        let row = client
            .query_one(
                "SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
                &[&wsp.id, &user.id],
            )
            .await?;

        WorkspaceMember::try_from(&row).map_err(|_| {
            anyhow!(
                "Failed to get workspace member with ID: {} in workspace: {}",
                user.id,
                wsp.id
            )
        })
    }

    async fn get_workspace_members(&self, wsp: &Workspace) -> Result<Vec<WorkspaceMember>> {
        let client = self.pool.get().await?;
        let rows = client
            .query(
                "SELECT * FROM workspace_members WHERE workspace_id = $1",
                &[&wsp.id],
            )
            .await?;
        let members: Vec<WorkspaceMember> = rows
            .iter()
            .map(|row| WorkspaceMember::try_from(row))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(members)
    }

    async fn get_user_workspaces(&self, user: &User) -> Result<Vec<Workspace>> {
        let client = self.pool.get().await?;
        let rows = client
            .query(
                "SELECT * FROM workspaces WHERE id IN (SELECT workspace_id FROM workspace_members WHERE user_id = $1)",
                &[&user.id],
            )
            .await?;
        let workspaces: Vec<Workspace> = rows
            .iter()
            .map(|row| Workspace::try_from(row))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(workspaces)
    }

    async fn remove_workspace_member(&self, org: &Workspace, user: &User) -> Result<()> {
        let client = self.pool.get().await?;
        let rows_affected = client
            .execute(
                "DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
                &[&org.id, &user.id],
            )
            .await?;
        if rows_affected == 0 {
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

        let config_variant_str = connection.config.to_string();
        println!("Config variant: {}", config_variant_str);

        let client = self.pool.get().await?;
        let rows_affected = client
            .execute(
                "INSERT INTO connections (id, name, tenancy, shared_capacity, workspace_id, connector_type, config) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                &[
                    &connection.id,
                    &connection.name,
                    &tenancy_str,
                    &shared_capacity.map(|cap| cap as i32),
                    &workspace_id,
                    &config_variant_str,
                    &serde_json::to_value(&connection.config)?,
                ],
            )
            .await?;

        if rows_affected == 0 {
            return Err(anyhow!("Failed to create connection."));
        }
        Ok(())
    }

    async fn get_connection(&self, connection_id: &Uuid) -> Result<ConnectionConfig> {
        let client = self.pool.get().await?;
        let row = client
            .query_one("SELECT * FROM connections WHERE id = $1", &[&connection_id])
            .await?;
        let connection = ConnectionConfig::try_from(&row)
            .map_err(|_| anyhow!("Failed to get connection with ID: {}", connection_id))?;
        Ok(connection)
    }

    async fn create_connection_access(&self, ca: &WorkspaceConnectionAccess) -> Result<()> {
        let client = self.pool.get().await?;
        let rows_affected = client
            .execute(
                "INSERT INTO connection_access (workspace_id, connection_id) VALUES ($1, $2)",
                &[&ca.workspace_id, &ca.connection_id],
            )
            .await?;
        if rows_affected == 0 {
            return Err(anyhow!("Failed to create connection access."));
        }
        Ok(())
    }

    async fn get_accessible_connections(
        &self,
        wsp: &Workspace,
    ) -> Result<Vec<WorkspaceConnectionAccess>> {
        let client = self.pool.get().await?;
        let rows = client
            .query(
                "SELECT * FROM connection_access WHERE workspace_id = $1",
                &[&wsp.id],
            )
            .await?;
        let connections: Vec<WorkspaceConnectionAccess> = rows
            .iter()
            .map(|row| WorkspaceConnectionAccess::try_from(row))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(connections)
    }

    async fn get_accessible_connection(
        &self,
        wsp: &Workspace,
        con_id: &Uuid,
    ) -> Result<WorkspaceConnectionAccess> {
        let client = self.pool.get().await?;
        let row = client
            .query_one(
                "SELECT * FROM connection_access WHERE workspace_id = $1 AND connection_id = $2",
                &[&wsp.id, &con_id],
            )
            .await?;
        WorkspaceConnectionAccess::try_from(&row).map_err(|_| {
            anyhow!(
                "Failed to get accessible connection with ID: {} for workspace: {}",
                con_id,
                wsp.id
            )
        })
    }

    async fn create_layer_record(&self, layer: &crate::Layer) -> Result<()> {
        let client = self.pool.get().await?;
        let rows_affected = client
            .execute(
                "INSERT INTO layers (id, name, workspace_id, connection_id, uploaded_by) VALUES ($1, $2, $3, $4, $5)",
                &[
                    &layer.id,
                    &layer.name,
                    &layer.workspace_id,
                    &layer.connection_id,
                    &layer.uploaded_by,
                ],
            )
            .await?;
        if rows_affected == 0 {
            return Err(anyhow!("Failed to create layer record."));
        }
        Ok(())
    }

    async fn get_layer(&self, layer_id: &Uuid) -> Result<crate::Layer> {
        let client = self.pool.get().await?;
        let row = client
            .query_one("SELECT * FROM layers WHERE id = $1", &[&layer_id])
            .await?;
        crate::Layer::try_from(&row)
            .map_err(|_| anyhow!("Failed to get layer with ID: {}", layer_id))
    }

    async fn create_project(&self, project: &crate::Project) -> Result<()> {
        let client = self.pool.get().await?;
        let rows_affected = client
            .execute(
                "INSERT INTO projects (id, workspace_id, name, owner) VALUES ($1, $2, $3, $4)",
                &[
                    &project.id,
                    &project.workspace_id,
                    &project.name,
                    &project.owner_id,
                ],
            )
            .await?;
        if rows_affected == 0 {
            return Err(anyhow!("Failed to create project."));
        }
        Ok(())
    }

    async fn get_projects(&self, workspace_id: &Uuid) -> Result<Vec<crate::Project>> {
        let client = self.pool.get().await?;
        let rows = client
            .query(
                "SELECT * FROM projects WHERE workspace_id = $1",
                &[&workspace_id],
            )
            .await?;
        let projects: Vec<crate::Project> = rows
            .iter()
            .map(|row| crate::Project::try_from(row))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(projects)
    }

    async fn get_project(&self, workspace_id: &Uuid, project_id: &Uuid) -> Result<crate::Project> {
        let client = self.pool.get().await?;
        let row = client
            .query_one(
                "SELECT * FROM projects WHERE workspace_id = $1 AND id = $2",
                &[&workspace_id, &project_id],
            )
            .await?;
        crate::Project::try_from(&row).map_err(|_| {
            anyhow!(
                "Failed to get project with ID: {} in workspace: {}",
                project_id,
                workspace_id
            )
        })
    }

    async fn delete_project(&self, project: &crate::Project) -> Result<()> {
        let client = self.pool.get().await?;
        let rows_affected = client
            .execute("DELETE FROM projects WHERE id = $1", &[&project.id])
            .await?;
        if rows_affected == 0 {
            return Err(anyhow!("Failed to delete project."));
        }
        Ok(())
    }

    async fn update_user_password(&self, user: &User) -> Result<()> {
        let client = self.pool.get().await?;
        let rows_affected = client
            .execute(
                "UPDATE users SET password_hash = $1 WHERE id = $2",
                &[&user.hash, &user.id],
            )
            .await?;
        if rows_affected == 0 {
            return Err(anyhow!("Failed to update user password."));
        }
        Ok(())
    }
}
