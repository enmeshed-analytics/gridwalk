use crate::utils::hash_password;
use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use strum_macros::{Display, EnumString};
use uuid::Uuid;

#[derive(PartialEq, Debug, Display, EnumString, Clone, Deserialize, Serialize)]
#[strum(serialize_all = "snake_case")]
pub enum GlobalRole {
    Super,
    Support,
    Read,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub global_role: Option<GlobalRole>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub is_active: bool,
}

impl<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> for User {
    fn from_row(row: &'r sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        let role_str: Option<String> = row.try_get("global_role")?;
        // Convert the string to the enum, or bind None if no role.
        let global_role = role_str.map(|role| role.parse::<GlobalRole>().unwrap());
        Ok(Self {
            id: row.try_get("id")?,
            email: row.try_get("email")?,
            first_name: row.try_get("first_name")?,
            last_name: row.try_get("last_name")?,
            global_role,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            is_active: row.try_get("is_active")?,
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateUser {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub global_role: Option<GlobalRole>,
    pub password: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Profile {
    pub id: Uuid,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub is_active: bool,
}

impl From<User> for Profile {
    fn from(user: User) -> Self {
        Profile {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            is_active: user.is_active,
        }
    }
}

impl User {
    pub fn new(
        email: String,
        first_name: String,
        last_name: String,
        global_role: Option<GlobalRole>,
    ) -> Self {
        let created_at = Utc::now();
        let updated_at = created_at;
        Self {
            id: Uuid::new_v4(),
            email,
            first_name,
            last_name,
            global_role,
            created_at,
            updated_at,
            is_active: true,
        }
    }

    pub async fn save(
        &self,
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), sqlx::Error> {
        let query = "INSERT INTO app_data.users (id, email, first_name, last_name, is_active, global_role) VALUES ($1, $2, $3, $4, $5, $6)";
        sqlx::query(query)
            .bind(&self.id)
            .bind(&self.email)
            .bind(&self.first_name)
            .bind(&self.last_name)
            .bind(&self.is_active)
            // Convert the enum to its string representation, or bind None if no role.
            .bind(self.global_role.clone().map(|role| role.to_string()))
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    pub async fn from_id(pool: &sqlx::PgPool, user_id: &Uuid) -> Result<User, sqlx::Error> {
        let query = "SELECT * FROM app_data.users WHERE id = $1";
        let user = sqlx::query_as::<_, User>(query)
            .bind(user_id)
            .fetch_one(pool)
            .await?;

        Ok(user)
    }

    pub async fn from_email<'e, E>(executor: E, email: &str) -> Result<Self, sqlx::Error>
    where
        E: sqlx::PgExecutor<'e>,
    {
        let query = "SELECT * FROM app_data.users WHERE email = $1";
        let user = sqlx::query_as::<_, User>(query)
            .bind(email)
            .fetch_one(executor)
            .await?;

        Ok(user)
    }

    pub async fn change_password(&self, pool: &sqlx::PgPool, new_password: &str) -> Result<()> {
        let new_hash = hash_password(new_password)?;
        let updated_at = Utc::now();
        let query = "UPDATE app_data.user_passwords SET hash = $1, updated_at = $2 WHERE id = $3";
        sqlx::query(query)
            .bind(new_hash)
            .bind(updated_at)
            .bind(self.id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn check_global_role(&self) -> Option<GlobalRole> {
        match &self.global_role {
            Some(support_level) => Some(support_level.clone()),
            None => None,
        }
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

    pub async fn save(
        &self,
        tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), sqlx::Error> {
        let query = "
        INSERT INTO app_data.user_passwords (user_id, hash, created_at, updated_at)
        VALUES ($1, $2, $3, $4)";

        sqlx::query(query)
            .bind(&self.user_id)
            .bind(&self.hashed_password)
            .bind(&self.created_at)
            .bind(&self.updated_at)
            .execute(&mut **tx)
            .await?;

        Ok(())
    }

    pub async fn from_user(pool: &sqlx::PgPool, user: &User) -> Result<UserPassword, sqlx::Error> {
        let query = "
        SELECT * FROM app_data.user_passwords WHERE user_id = $1";
        let user_password = sqlx::query_as::<_, UserPassword>(query)
            .bind(user.id)
            .fetch_one(pool)
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
            .or_else(|_| Ok(false))
    }
}
