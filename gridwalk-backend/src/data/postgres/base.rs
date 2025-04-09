use crate::data::{Database, UserStore};
use crate::{
    Connection, ConnectionAccess, CreateUser, Email, GlobalRole, Layer, PostgresConnection,
    Project, User, Workspace, WorkspaceMember, WorkspaceRole,
};
use anyhow::{anyhow, Result};
use sqlx::migrate::MigrateDatabase;
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::sync::Arc;
use tracing::info;

#[derive(Debug, Clone)]
pub struct Postgres {
    pub pool: PgPool,
    pub schema: Option<String>,
}

//impl Database for Postgres {}

impl Postgres {
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
            config.username, config.password, config.host, config.port, config.database
        );

        // Check if database exists, create if it doesn't
        if !sqlx::Postgres::database_exists(&connection_string).await? {
            info!("Database does not exist, creating...");
            sqlx::Postgres::create_database(&connection_string).await?;
            info!("Database created successfully");
        }

        // Create connection pool
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(&connection_string)
            .await?;

        // Initialize schema if provided
        if let Some(schema_name) = &config.schema {
            sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", schema_name))
                .execute(&pool)
                .await?;
            sqlx::query(&format!("SET search_path TO {}", schema_name))
                .execute(&pool)
                .await?;
        }

        // Run migrations using the sqlx::migrate! macro
        // This assumes you have migration files in the ./migrations directory
        sqlx::migrate!("src/data/postgres/migrations/")
            .run(&pool)
            .await?;

        info!("Database migrations executed successfully");

        let postgres = Arc::new(Postgres {
            pool,
            schema: config.schema,
        }) as Arc<dyn Database>;

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

    async fn ensure_tables_exist(pool: &PgPool, schema: &Option<String>) -> Result<()> {
        // Set the search path if a schema is specified
        Ok(())
    }
}
