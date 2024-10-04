use rand::{distributions::Alphanumeric, thread_rng, Rng};

pub async fn create_id(length: u64) -> String {
    let code: String = (0..length)
        .map(|_| thread_rng().sample(Alphanumeric) as char)
        .collect();
    code.to_uppercase()
}
