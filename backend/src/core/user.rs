use crate::core::create_id;
use crate::data::Database;
use anyhow::{anyhow, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::ops::{Deref, DerefMut};
use std::str::FromStr;
use strum_macros::Display;

#[derive(Debug, Display, Clone, Serialize, Deserialize, PartialEq)]
pub enum Role {
    Superuser,
    OrgAdmin,
    TeamAdmin,
    OrgRead,
    TeamRead,
}

impl FromStr for Role {
    type Err = String; // Using String as error type for simplicity

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_lowercase().as_str() {
            "superuser" => Ok(Role::Superuser),
            "orgadmin" => Ok(Role::OrgAdmin),
            "teamadmin" => Ok(Role::TeamAdmin),
            "orgread" => Ok(Role::OrgRead),
            "teamread" => Ok(Role::TeamRead),
            _ => Err(format!("Unknown role: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Roles(pub Vec<Role>);

impl fmt::Display for Roles {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[")?;
        for (i, role) in self.0.iter().enumerate() {
            if i > 0 {
                write!(f, ", ")?;
            }
            write!(f, "{}", role)?;
        }
        write!(f, "]")
    }
}

impl From<&String> for Roles {
    fn from(s: &String) -> Self {
        let trimmed = s.trim().trim_start_matches('[').trim_end_matches(']');
        let roles: Vec<Role> = trimmed
            .split(',')
            .map(|s| s.trim())
            .filter_map(|role_str| Role::from_str(role_str).ok())
            .collect();
        Roles(roles)
    }
}

impl Deref for Roles {
    type Target = Vec<Role>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Roles {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub roles: Roles,
    pub active: bool,
    pub hash: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateUser {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub roles: Roles,
    pub password: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Email {
    pub email: String,
    pub user_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Profile {
    pub id: String,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub roles: Roles,
    pub active: bool,
}

impl User {
    pub async fn create<T: Database>(database: T, user: &CreateUser) -> Result<()> {
        let user_id = create_id(10).await;
        let new_user = User::from_create_user(user, &user_id, true);
        match database.get_user_by_email(&new_user.email).await {
            Ok(_) => Err(anyhow!("email address already registered")),
            Err(_) => database.create_user(&new_user).await,
        }
    }

    pub async fn from_id<T: Database>(database: T, id: &str) -> Result<User> {
        database.get_user_by_id(id).await
    }

    pub async fn from_email<T: Database>(database: T, email: &str) -> Result<User> {
        database.get_user_by_email(email).await
    }

    fn from_create_user(create_user: &CreateUser, id: &str, active: bool) -> User {
        // Generate password hash
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(create_user.password.as_bytes(), &salt)
            .unwrap()
            .to_string();

        User {
            id: id.to_string(),
            email: create_user.email.to_string(),
            first_name: create_user.first_name.to_string(),
            last_name: create_user.last_name.to_string(),
            roles: create_user.roles.clone(),
            active,
            hash: password_hash,
        }
    }
}
