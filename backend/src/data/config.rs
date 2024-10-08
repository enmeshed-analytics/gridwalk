use crate::core::{Role, Session, User, Workspace};
use anyhow::Result;
use async_trait::async_trait;

#[async_trait]
pub trait Database: Send + Sync + Clone + UserStore + SessionStore + 'static {}

#[async_trait]
pub trait UserStore: Send + Sync + Clone + 'static {
    async fn create_user(&self, user: &User) -> Result<()>;
    async fn get_user_by_email(&self, email: &str) -> Result<User>;
    async fn get_user_by_id(&self, id: &str) -> Result<User>;
    async fn create_workspace(&self, wsp: &Workspace) -> Result<()>;
    //
    async fn get_workspace_by_id(&self, id: &str) -> Result<Workspace>;
    async fn add_workspace_member(
        &self,
        org: &Workspace,
        user: &User,
        role: Role,
        joined_at: u64,
    ) -> Result<()>;
    async fn remove_workspace_member(&self, org: &Workspace, user: &User) -> Result<()>;
}

#[async_trait]
pub trait SessionStore: Send + Sync + Clone + 'static {
    async fn get_session_by_id(&self, id: &str) -> Result<Session>;
    async fn create_session(&self, user: Option<&'life1 User>, session_id: &str) -> Result<()>;
    async fn delete_session(&self, session_id: &str) -> Result<()>;
}
