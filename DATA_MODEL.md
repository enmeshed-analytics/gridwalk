# Data Model for Gridwalk

This is the data model used for the Gridwalk application. Currently, only DynamoDB is supported, with plans to add support for other databases in the future.

## DynamoDB (Single Table)
| PK | SK | Attributes | GSIs |
|---|---|---|---|
| ORG#<org_id> | ORG#<org_id> | org_name<br>org_leader<br>created_at | GSI_ORG_BY_NAME<br>org_name: <org_name> |
| ORG#<org_id> | TEAM#<team_id> | team_name<br>team_leader<br>created_at | |
| USER#<user_id> | USER#<user_id> | user_name<br>created_at | |
| EMAIL#<email_address> | EMAIL#<email_address> | user_id | |
| ORG#<org_id> | USER#<user_id> | user_role<br>joined_at | |
| USER#<user_id> | ORG#<org_id> |  | |
