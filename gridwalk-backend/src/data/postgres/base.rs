use crate::data::Database;
use crate::{CreateUser, GlobalRole};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sqlx::migrate::MigrateDatabase;
use sqlx::postgres::{PgPool, PgPoolOptions};
use sqlx::Executor;
use std::sync::Arc;
use tracing::info;

// TODO: Switch to tokio_postgres to match the rest of the code

#[derive(Debug, Clone)]
pub struct Postgres {
    pub pool: PgPool,
}

impl Database for Postgres {}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PostgresConnection {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub schema: String,
}

impl Postgres {
    // Create a new Postgres connection read config from env vars and call the new_with_config
    // function
    pub async fn new() -> Result<Arc<dyn Database>> {
        info!("Initializing Postgres connection");
        let config = PostgresConnection {
            host: std::env::var("POSTGRES_HOST").unwrap_or("localhost".to_string()),
            port: std::env::var("POSTGRES_PORT")
                .unwrap_or("5432".to_string())
                .parse()
                .unwrap(),
            database: std::env::var("POSTGRES_DB").unwrap_or("gridwalk".to_string()),
            username: std::env::var("POSTGRES_USER").unwrap_or("admin".to_string()),
            password: std::env::var("POSTGRES_PASSWORD").unwrap_or("password".to_string()),
            schema: std::env::var("POSTGRES_SCHEMA").unwrap_or("gridwalk".to_string()),
        };

        // TODO: Read initial user from env vars
        let initial_user = CreateUser {
            email: "admin@example.com:".to_string(),
            first_name: "Admin".to_string(),
            last_name: "User".to_string(),
            global_role: Some(GlobalRole::Super),
            password: "password".to_string(),
        };

        // Call the new_with_config function
        Ok(Postgres::new_with_config(&config, initial_user).await?)
    }

    pub async fn new_with_config(
        config: &PostgresConnection,
        initial_user: CreateUser,
    ) -> Result<Arc<dyn Database>> {
        info!("Initializing Postgres connection");

        // If initial user type is not super, return error
        if initial_user.global_role != Some(GlobalRole::Super) {
            return Err(anyhow!("Initial user must be of type Super"));
        }

        let connection_string = format!(
            "postgres://{}:{}@{}:{}/{}",
            &config.username, &config.password, &config.host, &config.port, &config.database
        );

        // Check if database exists, create if it doesn't
        if !sqlx::Postgres::database_exists(&connection_string).await? {
            info!("Database does not exist, creating...");
            sqlx::Postgres::create_database(&connection_string).await?;
            info!("Database created successfully");
        }

        // Create connection pool to run migrations
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&connection_string)
            .await?;

        sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", &config.schema))
            .execute(&pool)
            .await?;
        sqlx::query(&format!("SET search_path TO {}", &config.schema))
            .execute(&pool)
            .await?;

        // Run migrations using the sqlx::migrate! macro
        sqlx::migrate!("src/data/postgres/migrations/")
            .run(&pool)
            .await?;

        info!("Database migrations executed successfully");

        let schema_name = Arc::new(config.schema.clone());
        let pool = PgPoolOptions::new()
            .max_connections(20)
            .after_connect({
                // clone the Arc into the closure
                let schema_name = Arc::clone(&schema_name);
                move |conn, _meta| {
                    // and clone again inside each invocation
                    let schema_name = Arc::clone(&schema_name);
                    Box::pin(async move {
                        // load the age extension
                        conn.execute("LOAD 'age'").await?;
                        // set the search_path dynamically
                        let set_search_path = format!("SET search_path TO {}", schema_name);
                        conn.execute(&*set_search_path).await?;
                        Ok(())
                    })
                }
            })
            .connect(&connection_string)
            .await?;

        let postgres = Arc::new(Postgres { pool }) as Arc<dyn Database>;

        // Get initial user
        //let user = User::from_email(&postgres, &initial_user.email).await;
        //match user {
        //    Ok(_) => {
        //        info!("db init: admin user exists.");
        //    }
        //    Err(_) => {
        //        info!("db init: creating admin user.");
        //        User::create(&postgres, &initial_user).await?;
        //        info!("db init: admin user created.");
        //    }
        //}

        // Check if primary connection exists, create if it doesn't
        //match postgres.get_connection("primary").await {
        //    Ok(_) => {
        //        info!("db init: primary connection exists.");
        //    }
        //    Err(_) => {
        //        info!("db init: creating primary connection.");
        //        let primary_connection = Connection {
        //            id: "primary".to_string(),
        //            name: "Primary".to_string(),
        //            connector_type: "Postgres".to_string(),
        //            config: config.clone(),
        //        };
        //        primary_connection.create_record(&postgres).await?;
        //    }
        //}

        Ok(postgres)
    }
}
