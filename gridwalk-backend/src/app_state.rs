use crate::connector::GeoConnections;
use crate::data::Database;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub app_data: Arc<dyn Database>,
    pub geo_connections: GeoConnections,
}
