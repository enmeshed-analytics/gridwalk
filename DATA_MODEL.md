# Data Model for Gridwalk

This is the data model used for the Gridwalk application. Currently, only DynamoDB is supported, with plans to add support for other databases in the future.

## DynamoDB (Single Table)
| PK | SK | Attributes | GSIs |
|---|---|---|---|
| USER#<user_id> | USER#<user_id> | user_name<br>created_at<br>primary_email | |
| EMAIL#<email_address> | EMAIL#<email_address> | user_id | |
| WSP#<workspace_id> | WSP#<workspace_id> | workspace_name<br>workspace_owner<br>created_at | GSI_WORKSPACE_BY_NAME<br>workspace_name: <workspace_name> |
| WSP#<workspace_id> | USER#<user_id> | user_role<br>joined_at<br>user_id | GSI_USER_ID<br>user_id: <user_id> |
| WSP#<workspace_id> | CON#<connection_id> | name<br>connector_type<br>created_by<br>pg_host<br>pg_port<br>pg_db<br>pg_username<br>pg_password | |
| WSP#<workspace_id> | LAYER#<layer_id> | name<br>connection_id<br>uploaded_by<br>created_at | |
| WSP#<workspace_id> | PROJ#<project_id> | name<br>owner<br>created_at | |
| SESSION#<session_id> | SESSION#<session_id> | user_id<br>created_at | GSI_USER<br>user_id: <user_id> |
