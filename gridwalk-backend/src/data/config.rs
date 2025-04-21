use crate::{
    ConnectionConfig, Layer, Project, Session, User, Workspace, WorkspaceConnectionAccess,
    WorkspaceMember, WorkspaceRole,
};
use anyhow::Result;
use async_trait::async_trait;
use uuid::Uuid;

#[async_trait]
pub trait Database: Send + Sync + UserStore + SessionStore + 'static {}

#[async_trait]
pub trait UserStore: Send + Sync + 'static {
    async fn create_user(&self, user: &User) -> Result<()>;
    async fn get_user_by_email(&self, email: &str) -> Result<User>;
    async fn get_user_by_id(&self, id: &Uuid) -> Result<User>;
    async fn create_workspace(&self, wsp: &Workspace, admin: &User) -> Result<()>;
    async fn delete_workspace(&self, wsp: &Workspace) -> Result<()>;
    async fn get_workspace_by_id(&self, id: &Uuid) -> Result<Workspace>;
    async fn add_workspace_member(
        &self,
        wsp: &Workspace,
        user: &User,
        role: WorkspaceRole,
    ) -> Result<()>;
    async fn get_workspace_member(&self, wsp: &Workspace, user: &User) -> Result<WorkspaceMember>;
    async fn get_workspace_members(&self, wsp: &Workspace) -> Result<Vec<WorkspaceMember>>;
    async fn get_user_workspaces(&self, user: &User) -> Result<Vec<Workspace>>;
    async fn remove_workspace_member(&self, org: &Workspace, user: &User) -> Result<()>;
    async fn create_connection(&self, connection: &ConnectionConfig) -> Result<()>;
    async fn get_all_connections(&self) -> Result<Vec<ConnectionConfig>>;
    async fn get_connection(&self, connection_id: &Uuid) -> Result<ConnectionConfig>;
    async fn get_connection_usage_count(&self, connection_id: &Uuid) -> Result<usize>;
    async fn create_connection_access(&self, ca: &WorkspaceConnectionAccess) -> Result<()>;
    async fn get_accessible_connections(&self, wsp: &Workspace) -> Result<Vec<ConnectionConfig>>;
    async fn get_accessible_connections_by_connection(
        &self,
        connection_id: &Uuid,
    ) -> Result<Vec<WorkspaceConnectionAccess>>;
    async fn get_accessible_connection(
        &self,
        wsp: &Workspace,
        con_id: &Uuid,
    ) -> Result<WorkspaceConnectionAccess>;
    async fn create_layer_record(&self, layer: &Layer) -> Result<()>;
    async fn get_layer(&self, layer_id: &Uuid) -> Result<Layer>;
    async fn create_project(&self, project: &Project) -> Result<()>;
    async fn get_projects(&self, workspace_id: &Uuid) -> Result<Vec<Project>>;
    async fn get_project(&self, workspace_id: &Uuid, project_id: &Uuid) -> Result<Project>;
    async fn delete_project(&self, project: &Project) -> Result<()>;
    async fn update_user_password(&self, user: &User) -> Result<()>;
}

#[async_trait]
pub trait SessionStore: Send + Sync + 'static {
    async fn get_session_by_id(&self, id: &Uuid) -> Result<Session>;
    async fn create_session(&self, user: Option<&User>, session_id: &Uuid) -> Result<()>;
    async fn delete_session(&self, session_id: &Uuid) -> Result<()>;
}
