use crate::connector::ActiveConnections;
use crate::data::Database;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub app_data: Arc<dyn Database>,
    pub connections: ActiveConnections,
}
