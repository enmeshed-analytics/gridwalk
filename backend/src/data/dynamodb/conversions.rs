use crate::core::{Email, Org, Team, User};
use aws_sdk_dynamodb::types::AttributeValue as AV;
use std::collections::HashMap;

fn split_at_hash(input: &str) -> &str {
    input.split_once('#').unwrap().1
}

impl From<HashMap<String, AV>> for User {
    fn from(value: HashMap<String, AV>) -> Self {
        let user = User {
            id: split_at_hash(value.get("PK").unwrap().as_s().unwrap()).to_string(),
            email: split_at_hash(value.get("GSI1PK").unwrap().as_s().unwrap()).to_string(),
            first_name: value.get("first_name").unwrap().as_s().unwrap().to_string(),
            last_name: value.get("last_name").unwrap().as_s().unwrap().to_string(),
            active: *value.get("active").unwrap().as_bool().unwrap(),
            roles: value.get("user_roles").unwrap().as_s().unwrap().into(),
            hash: value.get("hash").unwrap().as_s().unwrap().to_string(),
        };
        user
    }
}

impl From<HashMap<String, AV>> for Email {
    fn from(value: HashMap<String, AV>) -> Self {
        Email {
            email: split_at_hash(value.get("PK").unwrap().as_s().unwrap()).to_string(),
            user_id: split_at_hash(value.get("GSI1PK").unwrap().as_s().unwrap()).to_string(),
        }
    }
}

impl From<HashMap<String, AV>> for Team {
    fn from(value: HashMap<String, AV>) -> Self {
        Team {
            id: split_at_hash(value.get("PK").unwrap().as_s().unwrap()).to_string(),
            name: split_at_hash(value.get("GSI1PK").unwrap().as_s().unwrap()).to_string(),
            active: *value.get("active").unwrap().as_bool().unwrap(),
        }
    }
}

impl From<HashMap<String, AV>> for Org {
    fn from(value: HashMap<String, AV>) -> Self {
        Org {
            id: split_at_hash(value.get("PK").unwrap().as_s().unwrap()).to_string(),
            name: split_at_hash(value.get("GSI1PK").unwrap().as_s().unwrap()).to_string(),
            active: *value.get("active").unwrap().as_bool().unwrap(),
        }
    }
}
