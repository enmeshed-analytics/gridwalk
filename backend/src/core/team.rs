use crate::core::create_id;
use crate::core::User;
use crate::data::Database;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

use super::get_unix_timestamp;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Team {
    pub id: String,
    pub name: String,
    pub leader: String,
    pub created_at: u64,
    pub active: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TeamMember {
    pub team_id: String,
    pub user_id: String,
    pub member_type: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RemoveTeamMember {
    pub team_id: String,
    pub user_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CreateTeam {
    pub name: String,
    pub leader: String,
}

impl Team {
    pub async fn create<T: Database>(database: T, team: &CreateTeam) -> Result<()> {
        let id = create_id(30).await;
        let now = get_unix_timestamp();
        let db_resp = database
            .create_team(&Team {
                id,
                name: team.name.clone(),
                leader: team.leader.clone(),
                created_at: now,
                active: true,
            })
            .await;

        match db_resp {
            Ok(_) => Ok(()),
            Err(_) => Err(anyhow!("failed to create team")),
        }
    }

    pub async fn from_id<T: Database>(database: T, id: &str) -> Result<Self> {
        Ok(database.get_team_by_id(id).await.unwrap())
    }

    pub async fn delete<T: Database>(database: T, id: &str) -> Result<()> {
        database.delete_team(id).await?;
        Ok(())
    }

    pub async fn add_member<T: Database>(self, database: T, user: &User) -> Result<()> {
        database.add_team_member(&self, user).await?;
        Ok(())
    }

    pub async fn remove_member<T: Database>(self, database: T, user: &User) -> Result<()> {
        database.remove_team_member(&self, user).await?;
        Ok(())
    }
}
