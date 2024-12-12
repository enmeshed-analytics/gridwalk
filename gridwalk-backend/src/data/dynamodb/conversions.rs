use crate::core::{
    Connection, ConnectionAccess, ConnectionAccessConfig, Email, PostgresConnection, Project,
    Session, User, Workspace, WorkspaceMember,
};
use aws_sdk_dynamodb::types::AttributeValue as AV;
use std::collections::HashMap;

fn split_at_hash(input: &str) -> &str {
    input.split_once('#').unwrap().1
}

// Convert DynamoDB response into User struct
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
            global_role: value
                .get("global_role")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| s.parse().ok()),
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

// Convert DynamoDB response into Connection struct
impl From<HashMap<String, AV>> for Connection {
    fn from(value: HashMap<String, AV>) -> Self {
        Connection {
            id: value.get("PK").unwrap().as_s().unwrap().into(),
            name: value.get("name").unwrap().as_s().unwrap().into(),
            connector_type: value.get("connector_type").unwrap().as_s().unwrap().into(),
            config: PostgresConnection {
                host: value.get("pg_host").unwrap().as_s().unwrap().into(),
                port: value
                    .get("pg_port")
                    .unwrap()
                    .as_s()
                    .unwrap()
                    .parse()
                    .unwrap(),
                database: value.get("pg_db").unwrap().as_s().unwrap().into(),
                username: value.get("pg_username").unwrap().as_s().unwrap().into(),
                password: value.get("pg_password").unwrap().as_s().unwrap().into(),
                schema: value
                    .get("pg_schema")
                    .and_then(|v| v.as_s().ok())
                    .map(Into::into),
            },
        }
    }
}

// Convert DynamoDB response into ConnectionAccess struct
impl From<HashMap<String, AV>> for ConnectionAccess {
    fn from(value: HashMap<String, AV>) -> Self {
        println!("{:?}", value);
        let parts: Vec<&str> = value
            .get("SK")
            .unwrap()
            .as_s()
            .unwrap()
            .split('#')
            .skip(1)
            .collect();
        let last_part: Vec<&str> = parts[1].split(':').collect();

        ConnectionAccess {
            workspace_id: split_at_hash(value.get("PK").unwrap().as_s().unwrap()).to_string(),
            connection_id: parts[0].to_string(),
            access_config: ConnectionAccessConfig::from_str(last_part[1], last_part[0].to_string())
                .unwrap(),
        }
    }
}

impl From<HashMap<String, AV>> for Project {
    fn from(value: HashMap<String, AV>) -> Self {
        Project {
            id: split_at_hash(value.get("SK").unwrap().as_s().unwrap()).to_string(),
            workspace_id: split_at_hash(value.get("PK").unwrap().as_s().unwrap()).to_string(),
            name: value.get("name").unwrap().as_s().unwrap().to_string(),
            uploaded_by: value
                .get("uploaded_by")
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
        }
    }
}
