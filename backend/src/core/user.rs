use crate::core::{create_id, get_unix_timestamp, hash_password};
use crate::data::Database;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub active: bool,
    pub created_at: u64,
    pub hash: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateUser {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
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
    pub active: bool,
}

impl From<User> for Profile {
    fn from(user: User) -> Self {
        Profile {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            active: user.active,
        }
    }
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
        let now = get_unix_timestamp();
        // Generate password hash
        let password_hash = hash_password(&create_user.password).unwrap();

        User {
            id: id.to_string(),
            email: create_user.email.to_string(),
            first_name: create_user.first_name.to_string(),
            last_name: create_user.last_name.to_string(),
            active,
            created_at: now,
            hash: password_hash,
        }
    }
}
