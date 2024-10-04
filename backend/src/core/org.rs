use crate::core::{create_id, User};
use crate::data::Database;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Org {
    pub id: String,
    pub name: String,
    pub active: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OrgMember {
    pub org_id: String,
    pub user_id: String,
    pub member_type: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RemoveOrgMember {
    pub org_id: String,
    pub user_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateOrg {
    pub name: String,
}

impl Org {
    pub async fn from_id<T: Database>(database: T, id: &str) -> Result<Self> {
        Ok(database.get_org_by_id(id).await.unwrap())
    }

    pub async fn from_name<T: Database>(database: T, name: &str) -> Result<Self> {
        Ok(database.get_org_by_name(name).await?)
    }

    pub async fn create<T: Database>(database: T, org: &CreateOrg) -> Result<()> {
        // Check for existing org with same name
        let org_id = create_id(30).await;
        let db_resp = database
            .create_org(&Org {
                id: org_id,
                name: org.name.clone(),
                active: true,
            })
            .await;

        match db_resp {
            Ok(_) => Ok(()),
            Err(_) => Err(anyhow!("failed to create org")),
        }
    }

    pub async fn delete<T: Database>(database: T, id: &str) -> Result<()> {
        database.delete_org(id).await?;
        Ok(())
    }

    pub async fn add_member<T: Database>(self, database: T, user: &User) -> Result<()> {
        database.add_org_member(&self, user).await?;
        Ok(())
    }

    pub async fn remove_member<T: Database>(self, database: T, user: &User) -> Result<()> {
        database.remove_org_member(&self, user).await?;
        Ok(())
    }
}
