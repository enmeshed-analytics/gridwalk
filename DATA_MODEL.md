# Data Model for Gridwalk

This is the data model used for the Gridwalk application. Currently, only DynamoDB is supported, with plans to add support for other databases in the future.

## DynamoDB (Single Table)

### Data Types

#### Connection

**Key**: `CON#<UUID>`

**Attributes**:

| Attribute | Type | Description |
|-----------|------|-------------|
| `connection_type` | String | Possible values: `[s3_delta_lake]` |
| `s3_path` | String | Full S3 path to the delta lake |
