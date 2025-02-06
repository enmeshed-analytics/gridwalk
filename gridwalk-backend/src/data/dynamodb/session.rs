use crate::core::Session;
use crate::data::{Dynamodb, SessionStore};
use crate::User;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue as AV;

#[async_trait]
impl SessionStore for Dynamodb {
    async fn create_session(&self, user: Option<&'life1 User>, session_id: &str) -> Result<()> {
        // Create the item to insert
        let mut item = std::collections::HashMap::new();
        let key = format!("{}{}", "SESSION#", session_id);

        item.insert(String::from("PK"), AV::S(key.clone()));
        item.insert(String::from("SK"), AV::S(key));

        if let Some(u) = user {
            item.insert(String::from("user_id"), AV::S(u.id.to_string()));
        }

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        Ok(())
    }

    async fn get_session_by_id(&self, id: &str) -> Result<Session> {
        let key = format!("SESSION#{id}");
        match self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AV::S(key.clone()))
            .key("SK", AV::S(key))
            .send()
            .await
        {
            Ok(response) => match response.item {
                Some(session_item) => Ok(session_item.into()),
                None => Err(anyhow!("session not found")),
            },
            Err(_e) => Err(anyhow!("session not found")),
        }
    }

    async fn delete_session(&self, session_id: &str) -> Result<()> {
        let key = format!("SESSION#{session_id}");
        self.client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AV::S(key.clone()))
            .key("SK", AV::S(key))
            .send()
            .await?;
        Ok(())
    }
}
