use crate::core::{Org, Session, Team, User};
use anyhow::Result;
use async_trait::async_trait;

#[async_trait]
pub trait Database: Send + Sync + Clone + UserStore + SessionStore + 'static {}

#[async_trait]
pub trait UserStore: Send + Sync + Clone + 'static {
    async fn create_user(&self, user: &User) -> Result<()>;
    async fn get_user_by_email(&self, email: &str) -> Result<User>;
    async fn get_user_by_id(&self, id: &str) -> Result<User>;
    async fn create_org(&self, org: &Org) -> Result<()>;
    async fn get_org_by_id(&self, id: &str) -> Result<Org>;
    async fn get_org_by_name(&self, name: &str) -> Result<Org>;
    async fn add_org_member(&self, org: &Org, user: &User) -> Result<()>;
    async fn remove_org_member(&self, org: &Org, user: &User) -> Result<()>;
    async fn delete_org(&self, id: &str) -> Result<()>;
    async fn create_team(&self, team: &Team) -> Result<()>;
    async fn get_teams(&self) -> Result<Vec<Team>>;
    async fn get_team_by_id(&self, id: &str) -> Result<Team>;
    async fn add_team_member(&self, team: &Team, user: &User) -> Result<()>;
    async fn remove_team_member(&self, team: &Team, user: &User) -> Result<()>;
    async fn delete_team(&self, id: &str) -> Result<()>;
}

#[async_trait]
pub trait SessionStore: Send + Sync + Clone + 'static {
    async fn get_session_by_id(&self, id: &str) -> Result<Session>;
    async fn create_session(&self, user: Option<&'life1 User>, session_id: &str) -> Result<()>;
    async fn delete_session(&self, session_id: &str) -> Result<()>;
}
