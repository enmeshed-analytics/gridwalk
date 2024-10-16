use crate::core::{Email, Session, User, Workspace, WorkspaceMember};
use aws_sdk_dynamodb::types::AttributeValue as AV;
use std::collections::HashMap;

// These functions convert the returned data from the aws_sdk_dynamodb into Gridwalk structs.

fn split_at_hash(input: &str) -> &str {
    input.split_once('#').unwrap().1
}

impl From<HashMap<String, AV>> for User {
    fn from(value: HashMap<String, AV>) -> Self {
        let user = User {
            id: split_at_hash(value.get("PK").unwrap().as_s().unwrap()).to_string(),
            email: value
                .get("primary_email")
                .unwrap()
                .as_s()
                .unwrap()
                .to_string(),
            first_name: value.get("first_name").unwrap().as_s().unwrap().to_string(),
            last_name: value.get("last_name").unwrap().as_s().unwrap().to_string(),
            active: *value.get("active").unwrap().as_bool().unwrap(),
            created_at: value
                .get("created_at")
                .unwrap()
                .as_n()
                .unwrap()
                .parse()
                .unwrap(),
            hash: value.get("hash").unwrap().as_s().unwrap().to_string(),
        };
        user
    }
}

// Convert DynamoDB response into Email struct
impl From<HashMap<String, AV>> for Email {
    fn from(value: HashMap<String, AV>) -> Self {
        Email {
            email: split_at_hash(value.get("PK").unwrap().as_s().unwrap()).to_string(),
            user_id: value.get("user_id").unwrap().as_s().unwrap().to_string(),
        }
    }
}

// Convert DynamoDB response into Workspace struct
impl From<HashMap<String, AV>> for Workspace {
    fn from(value: HashMap<String, AV>) -> Self {
        Workspace {
            id: split_at_hash(value.get("PK").unwrap().as_s().unwrap()).to_string(),
            name: value
                .get("workspace_name")
                .unwrap()
                .as_s()
                .unwrap()
                .to_string(),
            owner: value
                .get("workspace_owner")
                .unwrap()
                .as_s()
                .unwrap()
                .to_string(),
            created_at: value
                .get("created_at")
                .unwrap()
                .as_n()
                .unwrap()
                .parse()
                .unwrap(),
            active: *value.get("active").unwrap().as_bool().unwrap(),
        }
    }
}

// Convert DynamoDB response into Workspace struct
impl From<HashMap<String, AV>> for WorkspaceMember {
    fn from(value: HashMap<String, AV>) -> Self {
        WorkspaceMember {
            workspace_id: split_at_hash(value.get("PK").unwrap().as_s().unwrap()).to_string(),
            user_id: split_at_hash(value.get("SK").unwrap().as_s().unwrap()).to_string(),
            role: value.get("role").unwrap().as_s().unwrap().into(),
        }
    }
}

// Convert DynamoDB response into Session struct
impl From<HashMap<String, AV>> for Session {
    fn from(value: HashMap<String, AV>) -> Self {
        let user_id = value
            .get("user_id")
            .map(|user_id_value| user_id_value.as_s().unwrap().to_string());
        Session {
            id: split_at_hash(value.get("PK").unwrap().as_s().unwrap()).to_string(),
            user_id,
        }
    }
}
