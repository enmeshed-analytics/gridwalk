use super::base::Postgres;
use crate::data::UserStore;
use crate::{Connection, GlobalRole, User, Workspace, WorkspaceMember, WorkspaceRole};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use sqlx::encode::{Encode, IsNull};
use sqlx::postgres::{PgArgumentBuffer, PgRow, PgTypeInfo, PgValueRef};
use sqlx::{Decode, FromRow, Postgres as Pg, Row, Type};
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

    async fn create_connection(&self, connection: &Connection) -> Result<()> {
        let query =
            "INSERT INTO connections (id, name, connector_type, config) VALUES ($1, $2, $3, $4)";
        let result = sqlx::query(&query)
            .bind(&connection.id)
            .bind(&connection.name)
            .bind(&connection.connector_type)
            .bind(sqlx::types::Json(&connection.config))
            .execute(&self.pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(anyhow!("Failed to create connection."));
        }
        Ok(())
    }
}
