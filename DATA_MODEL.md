# Data Model for Gridwalk

This is the data model used for the Gridwalk application. Currently, only DynamoDB is supported, with plans to add support for other databases in the future.

## DynamoDB (Single Table)

| PK | SK | Attributes | GSIs |
|---|---|---|---|
| ORG#<org_id> | ORG#<org_id> | org_name<br>org_address<br>org_phone<br>created_at | GSI_ORG_BY_NAME<br>PK: ORG#<org_name><br>SK: ORG#<org_id> |
| ORG#<org_id> | TEAM#<team_id> | team_name<br>team_leader<br>team_size<br>created_at | GSI_TEAM_BY_NAME<br>PK: TEAM#<team_name><br>SK: ORG#<org_id> |
| USER#<user_id> | USER#<user_id> | user_name<br>created_at | GSI_USER_BY_NAME<br>PK: USER#<user_name><br>SK: USER#<user_id> |
| EMAIL#<email> | EMAIL#<email> | user_id | - |
| ORG#<org_id> | USER#<user_id> | user_role<br>joined_at | GSI_USER_ORGS<br>PK: USER#<user_id><br>SK: ORG#<org_id> |
