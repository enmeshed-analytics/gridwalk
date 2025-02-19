use crate::data::{Database, UserStore};
use crate::{
    Connection, ConnectionAccess, CreateUser, Email, GlobalRole, Layer, PostgresConnection,
    Project, User, Workspace, WorkspaceMember, WorkspaceRole,
};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use aws_config::meta::region::RegionProviderChain;
use aws_config::BehaviorVersion;
use aws_sdk_dynamodb::types::{
    AttributeDefinition, AttributeValue as AV, GlobalSecondaryIndex, KeySchemaElement, KeyType,
    KeysAndAttributes, Projection, ProjectionType, ProvisionedThroughput, ScalarAttributeType,
};
use aws_sdk_dynamodb::Client;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::info;

#[derive(Debug, Clone)]
pub struct Dynamodb {
    pub client: Client,
    pub table_name: String,
}

impl Database for Dynamodb {}

impl Dynamodb {
    pub async fn new() -> Result<Arc<dyn Database>> {
        let dynamodb_table =
            std::env::var("GW_DYNAMODB_TABLE").expect("GW_DYNAMODB_TABLE must be set");

        let postgres_host =
            std::env::var("GW_POSTGRES_HOST").expect("GW_POSTGRES_HOST must be set");
        // Default to 5432 if not set
        let postgres_port = std::env::var("GW_POSTGRES_PORT")
            .unwrap_or_else(|_| "5432".to_string())
            .parse::<u16>()
            .expect("GW_POSTGRES_PORT must be a number");

        let postgres_db = std::env::var("GW_POSTGRES_DB").expect("GW_POSTGRES_DB must be set");
        let postgres_username =
            std::env::var("GW_POSTGRES_USERNAME").expect("GW_POSTGRES_USERNAME must be set");
        let postgres_password =
            std::env::var("GW_POSTGRES_PASSWORD").expect("GW_POSTGRES_PASSWORD must be set");

        let gw_user_email = std::env::var("GW_USER_EMAIL").expect("GW_USER_EMAIL must be set");

        let gw_user_password =
            std::env::var("GW_USER_PASSWORD").expect("GW_USER_PASSWORD must be set");

        let local = std::env::var("GW_LOCAL")
            .unwrap_or_else(|_| "false".to_string())
            .parse::<bool>()
            .expect("GW_LOCAL must be a boolean");

        Self::new_with_config(
            local,
            &dynamodb_table,
            PostgresConnection {
                host: postgres_host,
                port: postgres_port,
                database: postgres_db,
                schema: None,
                username: postgres_username,
                password: postgres_password,
            },
            CreateUser {
                email: gw_user_email,
                first_name: "Initial".to_string(),
                last_name: "User".to_string(),
                global_role: Some(GlobalRole::Super),
                password: gw_user_password,
            },
        )
        .await
    }

    pub async fn new_with_config(
        local: bool,
        app_db_table_name: &str,
        geoconnection: PostgresConnection,
        initial_user: CreateUser,
    ) -> Result<Arc<dyn Database>> {
        let region_provider = RegionProviderChain::default_provider().or_else("eu-west-2");

        if local {
            info!("Running in local mode");
        }

        // If inital user type is not super, return error
        if initial_user.global_role != Some(GlobalRole::Super) {
            return Err(anyhow!("Initial user must be of type Super"));
        }

        // Set endpoint url to localhost to run locally
        let config = match local {
            true => {
                let defaults = aws_config::defaults(BehaviorVersion::latest())
                    .region(region_provider)
                    .load()
                    .await;
                aws_sdk_dynamodb::config::Builder::from(&defaults)
                    .endpoint_url("http://localhost:8000")
                    .build()
            }
            false => {
                let defaults = aws_config::defaults(BehaviorVersion::latest())
                    .region(region_provider)
                    .load()
                    .await;
                aws_sdk_dynamodb::config::Builder::from(&defaults).build()
            }
        };

        let client = Client::from_conf(config);
        // Check if table exists, create if it doesn't
        Self::ensure_table_exists(&client, app_db_table_name).await?;
        let dynamodb = Arc::new(Dynamodb {
            client: client.clone(),
            table_name: app_db_table_name.into(),
        }) as Arc<dyn Database>;

        // Get initial user
        let user = User::from_email(&dynamodb, &initial_user.email).await;
        match user {
            Ok(_) => {
                info!("db init: admin user exists.");
            }
            Err(_) => {
                info!("db init: creating admin user.");
                User::create(&dynamodb, &initial_user).await?;
                info!("db init: admin user created.");
            }
        }

        // Check if primary connection exists, create if it doesn't
        match dynamodb.get_connection("primary").await {
            Ok(_) => {
                info!("db init: primary connection exists.");
            }
            Err(_) => {
                info!("db init: creating primary connection.");
                let primary_connection = Connection {
                    id: "primary".to_string(),
                    name: "Primary".to_string(),
                    connector_type: "Postgres".to_string(),
                    config: geoconnection,
                };
                primary_connection.create_record(&dynamodb).await?;
            }
        }
        Ok(dynamodb)
    }

    async fn ensure_table_exists(client: &Client, table_name: &str) -> Result<()> {
        let resp = client.list_tables().send().await?;
        let tables = resp.table_names();
        if !tables.contains(&table_name.to_string()) {
            info!("Table does not exist. Creating table: {}", table_name);

            client
                .create_table()
                .table_name(table_name)
                .key_schema(
                    KeySchemaElement::builder()
                        .attribute_name("PK")
                        .key_type(KeyType::Hash)
                        .build()?,
                )
                .key_schema(
                    KeySchemaElement::builder()
                        .attribute_name("SK")
                        .key_type(KeyType::Range)
                        .build()?,
                )
                .attribute_definitions(
                    AttributeDefinition::builder()
                        .attribute_name("PK")
                        .attribute_type(ScalarAttributeType::S)
                        .build()?,
                )
                .attribute_definitions(
                    AttributeDefinition::builder()
                        .attribute_name("SK")
                        .attribute_type(ScalarAttributeType::S)
                        .build()?,
                )
                .attribute_definitions(
                    AttributeDefinition::builder()
                        .attribute_name("user_id")
                        .attribute_type(ScalarAttributeType::S)
                        .build()?,
                )
                .global_secondary_indexes(
                    GlobalSecondaryIndex::builder()
                        .index_name("user")
                        .key_schema(
                            KeySchemaElement::builder()
                                .attribute_name("user_id")
                                .key_type(KeyType::Hash)
                                .build()?,
                        )
                        .projection(
                            Projection::builder()
                                .projection_type(ProjectionType::All)
                                .build(),
                        )
                        .provisioned_throughput(
                            ProvisionedThroughput::builder()
                                .read_capacity_units(5)
                                .write_capacity_units(5)
                                .build()?,
                        )
                        .build()?,
                )
                .provisioned_throughput(
                    ProvisionedThroughput::builder()
                        .read_capacity_units(5)
                        .write_capacity_units(5)
                        .build()?,
                )
                .send()
                .await?;

            info!("Table created successfully.");
        }
        Ok(())
    }
}

#[async_trait]
impl UserStore for Dynamodb {
    async fn create_user(&self, user: &User) -> Result<()> {
        // Create the USER item to insert
        let mut item = std::collections::HashMap::new();
        let key = format!("{}{}", "USER#", user.id);
        let email = format!("{}{}", "EMAIL#", user.email);

        item.insert(String::from("PK"), AV::S(key.clone()));
        item.insert(String::from("SK"), AV::S(key.clone()));
        item.insert(String::from("primary_email"), AV::S(user.email.clone()));
        item.insert(String::from("first_name"), AV::S(user.first_name.clone()));
        item.insert(String::from("last_name"), AV::S(user.last_name.clone()));
        item.insert(String::from("active"), AV::Bool(user.active));
        item.insert(
            String::from("created_at"),
            AV::N(user.created_at.to_string()),
        );
        item.insert(String::from("hash"), AV::S(user.hash.clone()));

        if let Some(global_role) = &user.global_role {
            item.insert(String::from("global_role"), AV::S(global_role.to_string()));
        }

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        // Create the EMAIL item to insert
        let mut email_item = std::collections::HashMap::new();
        email_item.insert(String::from("PK"), AV::S(email.clone()));
        email_item.insert(String::from("SK"), AV::S(email));
        email_item.insert(String::from("user_id"), AV::S(user.id.clone()));

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(email_item))
            .send()
            .await?;

        Ok(())
    }

    async fn update_user_password(&self, user: &User) -> Result<()> {
        // Create update expression for the USER item
        let key = format!("USER#{}", user.id);

        self.client
            .update_item()
            .table_name(&self.table_name)
            .key("PK", AV::S(key.clone()))
            .key("SK", AV::S(key))
            .update_expression("SET #hash = :hash")
            .expression_attribute_names("#hash", "hash")
            .expression_attribute_values(":hash", AV::S(user.hash.clone()))
            .send()
            .await
            .map_err(|e| anyhow!("Failed to update password: {}", e))?;

        Ok(())
    }

    async fn get_user_by_email(&self, email: &str) -> Result<User> {
        let email_key = format!("EMAIL#{email}");
        match self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AV::S(email_key.clone()))
            .key("SK", AV::S(email_key))
            .send()
            .await
        {
            Ok(response) => {
                let response_item = response.clone().item;

                if let Some(email_item) = response_item {
                    let email_record: Email = email_item.into();
                    UserStore::get_user_by_id(self, &email_record.user_id).await
                } else {
                    Err(anyhow!("email not found"))
                }
            }
            Err(_e) => Err(anyhow!("email not found")),
        }
    }

    async fn get_user_by_id(&self, id: &str) -> Result<User> {
        let key = format!("USER#{id}");
        match self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AV::S(key.clone()))
            .key("SK", AV::S(key))
            .send()
            .await
        {
            Ok(response) => Ok(response.item.unwrap().into()),
            Err(_e) => Err(anyhow!("user not found")),
        }
    }

    async fn create_workspace(&self, wsp: &Workspace) -> Result<()> {
        // Create the WSP item to insert
        let mut item = std::collections::HashMap::new();
        let key = format!("{}{}", "WSP#", wsp.id);

        item.insert(String::from("PK"), AV::S(key.clone()));
        item.insert(String::from("SK"), AV::S(key.clone()));
        item.insert(String::from("workspace_name"), AV::S(wsp.name.clone()));
        item.insert(String::from("workspace_owner"), AV::S(wsp.owner.clone()));
        item.insert(
            String::from("created_at"),
            AV::N(wsp.created_at.clone().to_string()),
        );
        item.insert(String::from("active"), AV::Bool(wsp.active));

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(())
    }

    async fn delete_workspace(&self, wsp: &Workspace) -> Result<()> {
        let key = format!("{}{}", "WSP#", wsp.id);
        let mut key_map = std::collections::HashMap::new();
        key_map.insert(String::from("PK"), AV::S(key.clone()));
        key_map.insert(String::from("SK"), AV::S(key.clone()));

        // Call delete_item on the DynamoDB client
        self.client
            .delete_item()
            .table_name(&self.table_name)
            .set_key(Some(key_map))
            .send()
            .await?;

        Ok(())
    }

    async fn get_workspace_by_id(&self, id: &str) -> Result<Workspace> {
        let key = format!("WSP#{id}");
        match self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AV::S(key.clone()))
            .key("SK", AV::S(key))
            .send()
            .await
        {
            Ok(response) => response
                .item
                .ok_or_else(|| anyhow!("workspace not found"))
                .map(Into::into),
            Err(e) => Err(anyhow!("failed to query workspace: {}", e)),
        }
    }

    async fn get_workspaces(&self, user: &User) -> Result<Vec<String>> {
        let memberships = self
            .client
            .query()
            .table_name(&self.table_name)
            .index_name("user")
            .key_condition_expression("#user_id = :user_id")
            .filter_expression("begins_with(#pk, :prefix)")
            .expression_attribute_names("#user_id", "user_id")
            .expression_attribute_names("#pk", "PK")
            .expression_attribute_values(":user_id", AV::S(user.id.clone()))
            .expression_attribute_values(":prefix", AV::S("WSP#".to_string()))
            .send()
            .await
            .map_err(|e| anyhow!("Failed to query DynamoDB: {}", e))?;

        let workspace_ids: Vec<String> = memberships
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                item.get("PK")
                    .and_then(|av| av.as_s().ok())
                    .and_then(|pk| pk.strip_prefix("WSP#"))
                    .map(String::from)
            })
            .collect();

        Ok(workspace_ids)
    }

    async fn get_projects(&self, workspace_id: &str) -> Result<Vec<Project>> {
        let projects = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :prefix)")
            .expression_attribute_values(":pk", AV::S(format!("WSP#{}", workspace_id)))
            .expression_attribute_values(":prefix", AV::S("PROJ#".to_string()))
            .send()
            .await
            .map_err(|e| anyhow!("Failed to query DynamoDB: {}", e))?;

        let projects: Vec<Project> = projects
            .items
            .unwrap_or_default()
            .into_iter()
            .map(|item| item.into())
            .collect();

        Ok(projects)
    }

    async fn add_workspace_member(
        &self,
        org: &Workspace,
        user: &User,
        role: WorkspaceRole,
        joined_at: u64,
    ) -> Result<()> {
        let mut item = std::collections::HashMap::new();

        item.insert(String::from("PK"), AV::S(format!("WSP#{}", org.id)));
        item.insert(String::from("SK"), AV::S(format!("USER#{}", user.id)));
        item.insert(String::from("role"), AV::S(role.to_string()));
        item.insert(String::from("joined_at"), AV::N(joined_at.to_string()));
        item.insert(String::from("user_id"), AV::S(user.id.clone()));

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(())
    }

    async fn get_workspace_member(&self, wsp: &Workspace, user: &User) -> Result<WorkspaceMember> {
        let pk = format!("WSP#{0}", wsp.id);
        let sk = format!("USER#{0}", user.id);
        match self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AV::S(pk))
            .key("SK", AV::S(sk))
            .send()
            .await
        {
            Ok(response) => Ok(response.item.unwrap().into()),
            Err(_e) => Err(anyhow!("workspace not found")),
        }
    }

    async fn get_workspace_members(&self, wsp: &Workspace) -> Result<Vec<WorkspaceMember>> {
        let pk = format!("WSP#{}", wsp.id);

        // Get all member records for the workspace
        let members_response = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :user_prefix)")
            .expression_attribute_values(":pk", AV::S(pk))
            .expression_attribute_values(":user_prefix", AV::S("USER#".to_string()))
            .send()
            .await?;

        let member_items = members_response.items.unwrap_or_default();
        if member_items.is_empty() {
            return Ok(vec![]);
        }

        // Extract user IDs and create batch get request
        let keys: Vec<HashMap<String, AV>> = member_items
            .iter()
            .filter_map(|item| {
                let sk = item.get("SK")?.as_s().ok()?;
                Some(HashMap::from([
                    ("PK".to_string(), AV::S(sk.to_string())),
                    ("SK".to_string(), AV::S(sk.to_string())),
                ]))
            })
            .collect();

        let keys_and_attributes = KeysAndAttributes::builder().set_keys(Some(keys)).build()?;

        // Get all user records in one batch
        let user_responses = self
            .client
            .batch_get_item()
            .set_request_items(Some(HashMap::from([(
                self.table_name.clone(),
                keys_and_attributes,
            )])))
            .send()
            .await?;

        // Create a map of user_id -> email
        let email_map: HashMap<String, String> = user_responses
            .responses
            .and_then(|mut r| r.remove(&self.table_name))
            .unwrap_or_default()
            .iter()
            .filter_map(|item| {
                let id = item.get("PK")?.as_s().ok()?.strip_prefix("USER#")?;
                let email = item.get("primary_email")?.as_s().ok()?;
                Some((id.to_string(), email.to_string()))
            })
            .collect();

        // Convert member items, keeping original PK/SK and adding email
        let members = member_items
            .into_iter()
            .filter_map(|mut item| {
                let user_id = item
                    .get("SK")?
                    .as_s()
                    .ok()?
                    .strip_prefix("USER#")?
                    .to_string();
                let email = email_map.get(&user_id)?;

                // Add email to the item
                item.insert("email".to_string(), AV::S(email.clone()));

                // Ensure role exists (the From impl expects it)
                if !item.contains_key("role") {
                    item.insert("role".to_string(), AV::S("member".to_string()));
                }
                Some(item.into())
            })
            .collect();

        Ok(members)
    }

    async fn remove_workspace_member(&self, wsp: &Workspace, user: &User) -> Result<()> {
        self.client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AV::S(format!("WSP#{}", wsp.id)))
            .key("SK", AV::S(format!("USER#{}", user.id)))
            .send()
            .await?;

        Ok(())
    }

    async fn create_connection(&self, con: &Connection) -> Result<()> {
        // Create the connection item to insert
        let mut item = std::collections::HashMap::new();

        item.insert(String::from("PK"), AV::S(format!("CON#{}", con.clone().id)));
        item.insert(String::from("SK"), AV::S(format!("CON#{}", con.clone().id)));
        item.insert(String::from("name"), AV::S(con.clone().name));
        item.insert(
            String::from("connector_type"),
            AV::S(con.clone().connector_type),
        );
        item.insert(String::from("pg_host"), AV::S(con.clone().config.host));
        item.insert(
            String::from("pg_port"),
            AV::S(con.clone().config.port.to_string()),
        );
        item.insert(String::from("pg_db"), AV::S(con.clone().config.database));
        item.insert(
            String::from("pg_username"),
            AV::S(con.clone().config.username),
        );
        item.insert(
            String::from("pg_password"),
            AV::S(con.clone().config.password),
        );

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(())
    }

    async fn get_connection(&self, connection_id: &str) -> Result<Connection> {
        let pk = format!("CON#{connection_id}");
        let sk = format!("CON#{connection_id}");
        match self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AV::S(pk))
            .key("SK", AV::S(sk))
            .send()
            .await
        {
            Ok(response) => response
                .item
                .ok_or_else(|| anyhow!("connection not found"))
                .map(Into::into),
            Err(e) => Err(anyhow!("failed to fetch connection: {}", e)),
        }
    }

    async fn create_connection_access(&self, ca: &ConnectionAccess) -> Result<()> {
        // Create the connection item to insert
        let mut item = std::collections::HashMap::new();
        let sk = format!(
            "CONACC#{}#{}:{}",
            ca.clone().connection_id,
            ca.access_config.path(),
            ca.access_config.variant_name(),
        );

        item.insert(
            String::from("PK"),
            AV::S(format!("WSP#{}", ca.clone().workspace_id)),
        );
        item.insert(String::from("SK"), AV::S(sk));
        item.insert(
            String::from("source_workspace"),
            AV::S(ca.clone().workspace_id),
        );

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(())
    }

    async fn get_accessible_connections(&self, wsp: &Workspace) -> Result<Vec<ConnectionAccess>> {
        let pk = format!("WSP#{}", wsp.id);
        let sk_prefix = "CONACC#";

        let accessible_connections = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk_prefix)")
            .expression_attribute_values(":pk", AV::S(pk))
            .expression_attribute_values(":sk_prefix", AV::S(sk_prefix.to_string()))
            .send()
            .await?;

        let connections: Vec<ConnectionAccess> = accessible_connections
            .items
            .unwrap_or_default()
            .into_iter()
            .map(|item| item.into())
            .collect();

        Ok(connections)
    }

    async fn get_accessible_connection(
        &self,
        wsp: &Workspace,
        con_id: &str,
    ) -> Result<ConnectionAccess> {
        let pk = format!("WSP#{}", wsp.id);
        let sk_prefix = format!("CONACC#{}", con_id);

        let accessible_connections = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk_prefix)")
            .expression_attribute_values(":pk", AV::S(pk))
            .expression_attribute_values(":sk_prefix", AV::S(sk_prefix.to_string()))
            .send()
            .await?;

        let connections: Vec<ConnectionAccess> = accessible_connections
            .items
            .unwrap_or_default()
            .into_iter()
            .map(|item| item.into())
            .collect();

        // If connections is empty or has more than one item, return an error
        if connections.is_empty() {
            return Err(anyhow!("connection not found"));
        } else if connections.len() > 1 {
            return Err(anyhow!("multiple connections found"));
        }

        Ok(connections[0].clone())
    }

    async fn create_layer_record(&self, layer: &Layer) -> Result<()> {
        let mut item = std::collections::HashMap::new();

        item.insert(
            String::from("PK"),
            AV::S(format!("WSP#{}", layer.workspace_id)),
        );
        item.insert(String::from("SK"), AV::S(format!("LAYER#{}", layer.name)));
        item.insert(String::from("name"), AV::S(layer.clone().name));
        item.insert(
            String::from("uploaded_by"),
            AV::S(layer.clone().uploaded_by),
        );
        item.insert(
            String::from("created_at"),
            AV::N(layer.created_at.to_string()),
        );

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(())
    }

    async fn delete_project(&self, project: &Project) -> Result<()> {
        let mut key = std::collections::HashMap::new();
        key.insert(
            String::from("PK"),
            AV::S(format!("WSP#{}", project.workspace_id)),
        );
        key.insert(String::from("SK"), AV::S(format!("PROJ#{}", project.id)));

        self.client
            .delete_item()
            .table_name(&self.table_name)
            .set_key(Some(key))
            .send()
            .await?;

        Ok(())
    }

    async fn create_project(&self, project: &Project) -> Result<()> {
        let mut item = std::collections::HashMap::new();

        item.insert(
            String::from("PK"),
            AV::S(format!("WSP#{}", project.workspace_id)),
        );
        item.insert(String::from("SK"), AV::S(format!("PROJ#{}", project.id)));
        item.insert(String::from("name"), AV::S(project.clone().name));
        item.insert(
            String::from("uploaded_by"),
            AV::S(project.clone().uploaded_by),
        );
        item.insert(
            String::from("created_at"),
            AV::N(project.created_at.to_string()),
        );

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(())
    }
}
