use super::verification::VerificationCode;
use crate::utils::hash_password;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use strum_macros::{Display, EnumString};
use uuid::Uuid;

#[derive(Debug, Deserialize, PartialEq, Clone, strum_macros::EnumString, strum_macros::Display)]
#[strum(serialize_all = "snake_case")]
pub enum UserStatus {
    PendingApproval,
    ActivePendingVerification,
    Active,
    Inactive,
    Suspended,
    Archived,
}

#[derive(PartialEq, Debug, Display, EnumString, Clone, Deserialize, Serialize)]
#[strum(serialize_all = "snake_case")]
pub enum GlobalRole {
    Admin,
    Support,
    Read,
}

#[derive(Debug, Clone)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub global_role: Option<GlobalRole>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub status: UserStatus,
    pub notes: Option<serde_json::Value>,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for User {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        let role_str: Option<String> = row.try_get("global_role")?;
        // Convert the string to the enum, or bind None if no role.
        let global_role = role_str.map(|role| role.parse::<GlobalRole>().unwrap());
        let status_str: String = row.try_get("status")?;
        let status = status_str.parse::<UserStatus>().unwrap();

        // Handle optional notes column
        let notes = row.try_get("notes").ok();

        Ok(Self {
            id: row.try_get("id")?,
            email: row.try_get("email")?,
            first_name: row.try_get("first_name")?,
            last_name: row.try_get("last_name")?,
            global_role,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            status,
            notes,
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateUser {
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub global_role: Option<GlobalRole>,
    pub password: String,
}

#[derive(Serialize)]
pub struct Profile {
    pub id: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: String,
    pub registered_at: DateTime<Utc>,
    pub last_update: DateTime<Utc>,
}

impl From<User> for Profile {
    fn from(user: User) -> Self {
        Self {
            id: user.id.to_string(),
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            registered_at: user.created_at,
            last_update: user.updated_at,
        }
    }
}

impl User {
    pub fn new(
        email: String,
        first_name: Option<String>,
        last_name: Option<String>,
        global_role: Option<GlobalRole>,
        status: UserStatus,
        notes: Option<serde_json::Value>,
    ) -> Self {
        let created_at = Utc::now();
        let updated_at = created_at;
        Self {
            id: Uuid::new_v4(),
            email,
            first_name,
            last_name,
            global_role: global_role,
            created_at,
            updated_at,
            status,
            notes,
        }
    }

    pub async fn save<'e, E>(&self, executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "INSERT INTO app_data.users (id, email, first_name, last_name, global_role, status) VALUES ($1, $2, $3, $4, $5, $6::app_data.user_status)";
        sqlx::query(query)
            .bind(&self.id)
            .bind(&self.email)
            .bind(&self.first_name)
            .bind(&self.last_name)
            .bind(self.global_role.as_ref().map(|r| r.to_string()))
            .bind(self.status.to_string())
            .execute(executor)
            .await?;

        Ok(())
    }

    pub async fn from_id<'e, E>(executor: E, user_id: &Uuid) -> Result<User, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT id, email, first_name, last_name, global_role, created_at, updated_at, status::text as status FROM app_data.users WHERE id = $1";
        let user = sqlx::query_as::<_, User>(query)
            .bind(user_id)
            .fetch_one(executor)
            .await?;

        Ok(user)
    }

    pub async fn from_id_with_notes<'e, E>(executor: E, user_id: Uuid) -> Result<User, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "
            SELECT 
                u.id, u.email, u.first_name, u.last_name, u.global_role, 
                u.created_at, u.updated_at, u.status::text as status,
                COALESCE(n.notes, '{}'::jsonb) as notes
            FROM app_data.users u
            LEFT JOIN app_data.user_notes n ON u.id = n.user_id
            WHERE u.id = $1";
        let user = sqlx::query_as::<_, User>(query)
            .bind(user_id)
            .fetch_one(executor)
            .await?;

        Ok(user)
    }

    pub async fn from_email<'e, E>(executor: E, email: &str) -> Result<User, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT id, email, first_name, last_name, global_role, created_at, updated_at, status::text as status FROM app_data.users WHERE email = $1";
        let user = sqlx::query_as::<_, User>(query)
            .bind(email)
            .fetch_one(executor)
            .await?;

        Ok(user)
    }

    pub async fn from_email_with_notes<'e, E>(executor: E, email: &str) -> Result<User, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "
            SELECT 
                u.id, u.email, u.first_name, u.last_name, u.global_role, 
                u.created_at, u.updated_at, u.status::text as status,
                COALESCE(n.notes, '{}'::jsonb) as notes
            FROM app_data.users u
            LEFT JOIN app_data.user_notes n ON u.id = n.user_id
            WHERE u.email = $1";
        let user = sqlx::query_as::<_, User>(query)
            .bind(email)
            .fetch_one(executor)
            .await?;

        Ok(user)
    }

    /// Save or update user notes in the separate user_notes table
    pub async fn save_notes<'e, E>(
        &self,
        executor: E,
        notes: &serde_json::Value,
    ) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "
            INSERT INTO app_data.user_notes (user_id, notes)
            VALUES ($1, $2)
            ON CONFLICT (user_id)
            DO UPDATE SET notes = $2, updated_at = CURRENT_TIMESTAMP";

        sqlx::query(query)
            .bind(&self.id)
            .bind(notes)
            .execute(executor)
            .await?;

        Ok(())
    }

    /// Get user notes from the separate user_notes table
    pub async fn get_notes<'e, E>(
        &self,
        executor: E,
    ) -> Result<Option<serde_json::Value>, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT notes FROM app_data.user_notes WHERE user_id = $1";

        let result = sqlx::query_scalar::<_, serde_json::Value>(query)
            .bind(&self.id)
            .fetch_optional(executor)
            .await?;

        Ok(result)
    }

    /// Delete user notes from the separate user_notes table
    pub async fn delete_notes<'e, E>(&self, executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "DELETE FROM app_data.user_notes WHERE user_id = $1";

        sqlx::query(query).bind(&self.id).execute(executor).await?;

        Ok(())
    }

    /// Add a verification code to the user's notes, maintaining max of 5 codes
    pub async fn add_verification_code(
        &self,
        pg_pool: &sqlx::PgPool,
    ) -> Result<VerificationCode, sqlx::Error> {
        // Clean up old codes first (keep max 5)
        VerificationCode::cleanup_old_codes_for_user(pg_pool, &self.id).await?;

        // Create and save new code
        let verification_code = VerificationCode::new(self.id);
        verification_code.save(pg_pool).await?;

        Ok(verification_code)
    }

    pub async fn change_password<'e, E>(&self, executor: E, new_password: &str) -> Result<()>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let new_hash = hash_password(new_password)?;
        let updated_at = Utc::now();
        let query = "UPDATE gridwalk.user_passwords SET hash = $1, updated_at = $2 WHERE id = $3";
        sqlx::query(query)
            .bind(new_hash)
            .bind(updated_at)
            .bind(self.id)
            .execute(executor)
            .await?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct UserPassword {
    pub user_id: Uuid,
    pub hashed_password: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for UserPassword {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            user_id: row.try_get("user_id")?,
            hashed_password: row.try_get("hash")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

use argon2::password_hash::{rand_core::OsRng, SaltString};
use argon2::{Argon2, PasswordHasher, PasswordVerifier};

impl UserPassword {
    pub fn new(user_id: Uuid, new_password: String) -> Self {
        let salt = SaltString::generate(&mut OsRng);

        let argon2 = Argon2::default();

        let hashed_password = argon2
            .hash_password(new_password.as_bytes(), &salt)
            .expect("Failed to hash password")
            .to_string();

        let now: DateTime<Utc> = Utc::now();

        Self {
            user_id,
            hashed_password,
            created_at: now,
            updated_at: now,
        }
    }

    pub async fn save<'e, E>(&self, executor: E) -> Result<(), sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "
        INSERT INTO gridwalk.user_passwords (user_id, hash, created_at, updated_at)
        VALUES ($1, $2, $3, $4)";

        sqlx::query(query)
            .bind(self.user_id)
            .bind(&self.hashed_password)
            .bind(self.created_at)
            .bind(self.updated_at)
            .execute(executor)
            .await?;

        Ok(())
    }

    pub async fn from_user<'e, E>(executor: E, user: &User) -> Result<UserPassword, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "
        SELECT * FROM gridwalk.user_passwords WHERE user_id = $1";
        let user_password = sqlx::query_as::<_, UserPassword>(query)
            .bind(user.id)
            .fetch_one(executor)
            .await?;

        Ok(user_password)
    }

    pub async fn validate_password(
        &self,
        password: &str,
    ) -> Result<bool, argon2::password_hash::Error> {
        let argon2 = Argon2::default();
        let parsed_hash = argon2::PasswordHash::new(&self.hashed_password)?;
        argon2
            .verify_password(password.as_bytes(), &parsed_hash)
            .map(|_| true)
            .or(Ok(false))
    }
}
