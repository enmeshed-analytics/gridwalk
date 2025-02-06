use crate::{
    Connection, ConnectionAccess, Layer, Project, Session, User, Workspace, WorkspaceMember,
    WorkspaceRole,
};
use anyhow::Result;
use async_trait::async_trait;

#[async_trait]
pub trait Database: Send + Sync + UserStore + SessionStore + 'static {}

// TODO need to add in DELETE WORKSPACE
#[async_trait]
pub trait UserStore: Send + Sync + 'static {
    async fn create_user(&self, user: &User) -> Result<()>;
    async fn get_user_by_email(&self, email: &str) -> Result<User>;
    async fn get_user_by_id(&self, id: &str) -> Result<User>;
    async fn create_workspace(&self, wsp: &Workspace) -> Result<()>;
    async fn delete_workspace(&self, wsp: &Workspace) -> Result<()>;
    async fn get_workspace_by_id(&self, id: &str) -> Result<Workspace>;
    async fn add_workspace_member(
        &self,
        wsp: &Workspace,
        user: &User,
        role: WorkspaceRole,
        joined_at: u64,
    ) -> Result<()>;
    async fn get_workspace_member(&self, wsp: &Workspace, user: &User) -> Result<WorkspaceMember>;
    async fn get_workspace_members(&self, wsp: &Workspace) -> Result<Vec<WorkspaceMember>>;
    async fn remove_workspace_member(&self, org: &Workspace, user: &User) -> Result<()>;
    async fn create_connection(&self, connection: &Connection) -> Result<()>;
    async fn get_connection(&self, connection_id: &str) -> Result<Connection>;
    async fn create_connection_access(&self, ca: &ConnectionAccess) -> Result<()>;
    async fn get_accessible_connections(&self, wsp: &Workspace) -> Result<Vec<ConnectionAccess>>;
    async fn get_accessible_connection(
        &self,
        wsp: &Workspace,
        con_id: &str,
    ) -> Result<ConnectionAccess>;
    async fn create_layer_record(&self, layer: &Layer) -> Result<()>;
    async fn create_project(&self, project: &Project) -> Result<()>;
    async fn get_workspaces(&self, user: &User) -> Result<Vec<String>>;
    async fn get_projects(&self, workspace_id: &str) -> Result<Vec<Project>>;
    async fn delete_project(&self, project: &Project) -> Result<()>;
    async fn update_user_password(&self, user: &User) -> Result<()>;
}

#[async_trait]
pub trait SessionStore: Send + Sync + 'static {
    async fn get_session_by_id(&self, id: &str) -> Result<Session>;
    async fn create_session(&self, user: Option<&'life1 User>, session_id: &str) -> Result<()>;
    async fn delete_session(&self, session_id: &str) -> Result<()>;
}
