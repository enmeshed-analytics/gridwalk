use martin::Source;
use std::collections::HashMap;

#[derive(Clone)]
pub struct AppState {
    pub sources: HashMap<String, Box<dyn Source>>,
}
