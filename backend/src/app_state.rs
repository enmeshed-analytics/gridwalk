use crate::core::GeospatialConfig;
use crate::data::Database;

#[derive(Clone)]
pub struct AppState<D: Database> {
    pub app_data: D,
    pub geospatial_config: GeospatialConfig,
}
