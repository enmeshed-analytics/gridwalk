use crate::core::{CreateUser, Email, User, Workspace, WorkspaceMember, WorkspaceRole};
use crate::data::{Database, UserStore};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use aws_config::meta::region::RegionProviderChain;
use aws_config::BehaviorVersion;
use aws_sdk_dynamodb::types::{
    AttributeDefinition, AttributeValue as AV, GlobalSecondaryIndex, KeySchemaElement, KeyType,
    Projection, ProjectionType, ProvisionedThroughput, ScalarAttributeType,
};
use aws_sdk_dynamodb::Client;
use tracing::info;

#[derive(Debug, Clone)]
pub struct Dynamodb {
    pub client: Client,
    pub table_name: String,
}

impl Database for Dynamodb {}

impl Dynamodb {
    pub async fn new(local: bool, table_name: &str) -> Result<Self> {
        let region_provider = RegionProviderChain::default_provider().or_else("eu-west-2");

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
        Self::ensure_table_exists(&client, table_name).await?;
        let dynamodb = Dynamodb {
            client: client.clone(),
            table_name: table_name.into(),
        };
        Self::ensure_admin_user_exists(&dynamodb).await?;

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
                        .attribute_name("org_name")
                        .attribute_type(ScalarAttributeType::S)
                        .build()?,
                )
                .global_secondary_indexes(
                    GlobalSecondaryIndex::builder()
                        .index_name("OrgNameIndex")
                        .key_schema(
                            KeySchemaElement::builder()
                                .attribute_name("org_name")
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

    async fn ensure_admin_user_exists(dynamodb: &Dynamodb) -> Result<()> {
        let admin_user = User::from_email(dynamodb.clone(), "test@example.com").await;
        match admin_user {
            Ok(_) => {
                info!("db init: admin user exists.");
            }
            Err(_) => {
                info!("db init: creating admin user.");
                let admin_user = CreateUser {
                    email: String::from("test@example.com"),
                    first_name: String::from("Admin"),
                    last_name: String::from("Istrator"),
                    password: String::from("admin"),
                };
                User::create(dynamodb.clone(), &admin_user).await?;
                info!("db init: admin user created.");
            }
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
            Ok(response) => Ok(response.item.unwrap().into()),
            Err(_e) => Err(anyhow!("org not found")),
        }
    }

    async fn add_workspace_member(
        &self,
        org: &Workspace,
        user: &User,
        role: WorkspaceRole,
        joined_at: u64,
    ) -> Result<()> {
        // Create the workspace member item to insert
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

    async fn get_workspace_member(&self, wsp: Workspace, user: User) -> Result<WorkspaceMember> {
        println!("{wsp:?}");
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
}
