# Data Model for Gridwalk

This is the data model used for the Gridwalk application. Currently, only DynamoDB is supported, with plans to add support for other databases in the future.

## DynamoDB (Single Table)

| Entity            | PK            | SK                              | user_id | wsp_id | con_id  | Attributes                             |
|-------------------|---------------|---------------------------------|---------|--------|---------|----------------------------------------|
| User              | USER#{id}     | USER#{id}                       |         |        |         | created_at, active                     |
| User Global Role  | USER#{id}     | ROLE#[SUPER/SUPPORT/READ]       |         |        |         |                                        |
| Email             | EMAIL#{email} | EMAIL#{email}                   | &check; |        |         | [primary, secondary]                   |
| Session           | SESSION#{id}  | SESSION#{id}                    | &check; |        |         | created_at, login_ip                   |
|                   |               |                                 |         |        |         |                                        |
| Connection        | CON#{id/name} | CON#{id/name}                   |         |        |         | name, connector_type, connector_config |
| Connection Access | WSP#{id}      | CONACC#{id/name}#{wsp_id}:level |         |        | &check; |                                        |
|                   |               |                                 |         |        |         |                                        |
| Workspace         | WSP#{id}      | WSP#{id}                        |         |        |         | name, owner, created_at, active        |
| Workspace Member  | WSP#{id}      | USER#{id}                       | &check; |        |         | role, joined_at                        |
| Layer             | WSP#{id}      | LAYER#{layer_name}              |         |        | &check; | created_by, created_at                 |
| Project           | WSP#{id}      | PROJ#{id}                       |         |        |         | name, owner, created_at                |

## Notes
 - The Connection entity may have an ID or a name. A Connection with a name is used for global connectors created by the system administrators. A Connection with an ID is used for user-created connectors.
