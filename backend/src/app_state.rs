use crate::data::Database;
use martin::Source;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct AppState<D: Database> {
    pub app_data: D,
    pub sources: HashMap<String, Box<dyn Source>>,
}
