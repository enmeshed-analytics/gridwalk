use anyhow::{anyhow, Result};
use async_trait::async_trait;
use deadpool_postgres::{Config, Pool, Runtime};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_postgres::NoTls;
use url::Url;

use crate::data::Database;

// TODO: Switch connector_type/postgis_uri to enum to support other connectors
#[derive(Debug, Clone, Deserialize)]
pub struct Connection {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub created_by: String,
    pub connector_type: String,
    pub postgis_uri: String,
}

impl Connection {
    pub async fn create_record(self, database: &Arc<dyn Database>) -> Result<()> {
        database.create_connection(&self).await?;
        Ok(())
    }

    pub async fn from_id(
        database: &Arc<dyn Database>,
        workspace_id: &str,
        connection_id: &str,
    ) -> Result<Self> {
        let con = database
            .get_workspace_connection(workspace_id, connection_id)
            .await?;
        Ok(con)
    }
}

// Trait for all geospatial data sources
#[async_trait]
pub trait GeoConnector: Send + Sync {
    async fn connect(&mut self) -> Result<()>;
    async fn disconnect(&mut self) -> Result<()>;
    async fn list_sources(&self) -> Result<()>;
    fn clone_box(&self) -> Box<dyn GeoConnector>;
}

#[derive(Clone, Debug)]
pub enum PostgresConnection {
    Uri(String),
    Params {
        host: String,
        port: u16,
        database: String,
        username: String,
        password: String,
    },
}

#[derive(Clone, Debug)]
pub struct PostgisConfig {
    connection: PostgresConnection,
    pool: Option<Arc<Pool>>,
}

impl PostgisConfig {
    pub fn new_from_uri(uri: String) -> Result<Self> {
        // Validate the URI
        Url::parse(&uri).map_err(|_| anyhow!("Invalid PostgreSQL URI"))?;
        Ok(PostgisConfig {
            connection: PostgresConnection::Uri(uri),
            pool: None,
        })
    }

    //pub fn new_from_params(
    //    host: String,
    //    port: u16,
    //    database: String,
    //    username: String,
    //    password: String,
    //) -> Self {
    //    PostgisConfig {
    //        connection: PostgresConnection::Params {
    //            host,
    //            port,
    //            database,
    //            username,
    //            password,
    //        },
    //        pool: None,
    //    }
    //}

    fn get_config(&self) -> Config {
        match &self.connection {
            PostgresConnection::Uri(uri) => {
                let mut config = Config::new();
                config.url = Some(uri.clone());
                config
            }
            PostgresConnection::Params {
                host,
                port,
                database,
                username,
                password,
            } => {
                let mut config = Config::new();
                config.host = Some(host.clone());
                config.port = Some(*port);
                config.dbname = Some(database.clone());
                config.user = Some(username.clone());
                config.password = Some(password.clone());
                config
            }
        }
    }
}

#[async_trait]
impl GeoConnector for PostgisConfig {
    async fn connect(&mut self) -> Result<()> {
        println!("Connecting to Postgis database...");
        let config = self.get_config();
        let pool = config.create_pool(Some(Runtime::Tokio1), NoTls)?;

        // Test the connection
        let client = pool.get().await?;
        client.query("SELECT 1", &[]).await?;

        // If successful, store the pool
        self.pool = Some(Arc::new(pool));
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<()> {
        // For deadpool, explicit disconnection is not necessary
        // The pool will be dropped when it goes out of scope
        self.pool = None;
        Ok(())
    }

    fn clone_box(&self) -> Box<dyn GeoConnector> {
        Box::new(PostgisConfig {
            connection: self.connection.clone(),
            pool: self.pool.clone(),
        })
    }

    async fn list_sources(&self) -> Result<()> {
        println!("Attempting to list sources...");
        let pool = self
            .pool
            .as_ref()
            .ok_or_else(|| anyhow!("Database not connected"))?;
        let client = pool.get().await?;

        let rows = client
            .query(
                "SELECT DISTINCT f.table_name 
                 FROM information_schema.columns f 
                 JOIN pg_type t ON f.udt_name = t.typname 
                 WHERE t.typtype = 'b' 
                 AND t.typname IN ('geometry', 'geography') 
                 AND f.table_schema = 'public'",
                &[],
            )
            .await?;

        println!("Tables with geometry columns in the public schema:");
        for row in rows {
            let table_name: String = row.get(0);
            println!("- {}", table_name);
        }

        Ok(())
    }
}

#[derive(Clone, Debug)]
pub struct PmtilesConfig {
    pub path: String,
}

#[async_trait]
impl GeoConnector for PmtilesConfig {
    async fn connect(&mut self) -> Result<()> {
        // Implement PMTiles connection logic
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<()> {
        // Implement PMTiles disconnection logic
        Ok(())
    }

    fn clone_box(&self) -> Box<dyn GeoConnector> {
        Box::new(self.clone())
    }

    async fn list_sources(&self) -> Result<()> {
        Ok(())
    }
}

#[derive(Clone)]
pub struct GeospatialConfig {
    sources: Arc<RwLock<HashMap<String, Box<dyn GeoConnector>>>>,
}

impl GeospatialConfig {
    pub fn new() -> Self {
        GeospatialConfig {
            sources: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn add_connection<T: GeoConnector + 'static>(&self, name: String, source: T) {
        let mut sources = self.sources.write().await;
        sources.insert(name, Box::new(source));
    }

    pub async fn get_connection(&self, connection_id: &str) -> Result<Box<dyn GeoConnector>> {
        let sources = self.sources.read().await;
        sources
            .get(connection_id)
            .ok_or_else(|| anyhow!("Source not found"))
            .map(|source| source.clone_box())
    }

    pub async fn remove_connection(&self, name: &str) -> Option<Box<dyn GeoConnector>> {
        let mut sources = self.sources.write().await;
        sources.remove(name)
    }
}
