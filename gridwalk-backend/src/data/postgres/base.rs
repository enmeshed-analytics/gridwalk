use crate::data::Database;
use crate::{CreateUser, GlobalRole, User};
use anyhow::{anyhow, Result};
use deadpool_postgres::{ClientWrapper, Hook, HookError};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::info;

#[derive(Debug, Clone)]
pub struct Postgres {
    pub pool: deadpool_postgres::Pool,
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

mod embedded {
    use refinery::embed_migrations;
    embed_migrations!("./src/data/postgres/migrations");
}

impl Postgres {
    // Create a new Postgres connection read config from env vars and call the new_with_config
    // function
    pub async fn new() -> Result<Arc<dyn Database>> {
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
            email: "admin@gridwalk.co".to_string(),
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

        // Construct the tokio_postgres::Config
        let mut pg_cfg = tokio_postgres::Config::new();
        pg_cfg
            .host(&config.host)
            .port(config.port)
            .user(&config.username)
            .password(&config.password)
            .dbname(&config.database)
            .application_name("gridwalk")
            .connect_timeout(std::time::Duration::from_secs(5));

        // Run refinery migrations on a standalone client
        {
            // Create a new client and spawn a connection task to run the migrations
            let (mut client, connection) = pg_cfg.clone().connect(tokio_postgres::NoTls).await?;
            tokio::spawn(async move {
                if let Err(e) = connection.await {
                    tracing::error!("Postgres connection error: {}", e);
                }
            });

            // Create the schema if it doesn't exist and set the search path
            let schema = &config.schema;
            let create_and_set = format!(
                "CREATE SCHEMA IF NOT EXISTS {schema};\n\
                 SET search_path TO {schema};",
                schema = schema
            );
            client.batch_execute(&create_and_set).await?;

            // Run the migrations
            let report = embedded::migrations::runner()
                .run_async(&mut client)
                .await?;
            for m in report.applied_migrations() {
                tracing::info!("Migration applied: {} v{}", m.name(), m.version());
            }
            tracing::info!("All migrations applied successfully");
        } // Migration scope ends here with the client being dropped

        let manager_config = deadpool_postgres::ManagerConfig {
            recycling_method: deadpool_postgres::RecyclingMethod::Fast,
        };
        let manager =
            deadpool_postgres::Manager::from_config(pg_cfg, tokio_postgres::NoTls, manager_config);

        // Create a new pool for the app state
        let schema_name = Arc::new(config.schema.clone());
        let pool = deadpool_postgres::Pool::builder(manager)
            .max_size(20)
            .post_create(Hook::async_fn(move |client: &mut ClientWrapper, _| {
                let schema = schema_name.clone();
                Box::pin(async move {
                    client
                        .simple_query(&format!("set search_path = {}", schema))
                        .await
                        .map_err(|e| HookError::Backend(e))?;
                    Ok(())
                })
            }))
            .build()
            .unwrap();

        let postgres = Arc::new(Postgres { pool }) as Arc<dyn Database>;

        // Get initial user
        let user = User::from_email(&postgres, &initial_user.email).await;
        match user {
            Ok(_) => {
                info!("db init: admin user exists.");
            }
            Err(_) => {
                info!("db init: creating admin user.");
                User::create(&postgres, &initial_user).await?;
                info!("db init: admin user created.");
            }
        }

        Ok(postgres)
    }
}
