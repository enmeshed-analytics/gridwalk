-- Create schema
CREATE SCHEMA IF NOT EXISTS gridwalk;

-- Users table
CREATE TABLE gridwalk.users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    hash VARCHAR(255) NOT NULL,
    global_role VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Workspaces table
CREATE TABLE gridwalk.workspaces (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Workspace members (join table)
CREATE TABLE gridwalk.workspace_members (
    workspace_id UUID REFERENCES gridwalk.workspaces(id),
    user_id UUID REFERENCES gridwalk.users(id),
    role VARCHAR(50) NOT NULL, -- e.g., 'admin', 'editor', 'viewer'
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, user_id)
);

-- Connections table
CREATE TABLE gridwalk.connections (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tenancy STRING NOT NULL, -- e.g., 'shared', 'private'
    shared_capacity INTEGER, -- set if tenancy_type is 'shared'
    workspace_id UUID, -- set if tenancy_type is 'workspace'
    connector_type VARCHAR(50) NOT NULL, -- e.g., 'Postgres', 'MySQL', 'SQLite', 'GeoJSON', 'Shapefile', etc.

    -- Store all connection configuration as JSON based on connector type
    connection_config JSONB NOT NULL,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE

    -- Add a check constraint to ensure data consistency.
    CONSTRAINT tenancy_valid CHECK (
         (tenancy_type = 'shared' AND shared_capacity IS NOT NULL AND workspace_id IS NULL)
      OR (tenancy_type = 'workspace' AND workspace_id IS NOT NULL AND shared_capacity IS NULL)
    )
);

-- Connection access rights
CREATE TABLE gridwalk.connection_access (
    workspace_id UUID REFERENCES gridwalk.workspaces(id),
    connection_id UUID REFERENCES gridwalk.connections(id),
    access_path VARCHAR(255) NOT NULL,
    access_variant VARCHAR(50) NOT NULL, -- e.g., 'read', 'write', 'owner'
    PRIMARY KEY (workspace_id, connection_id)
);

-- Projects table
CREATE TABLE gridwalk.projects (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES gridwalk.workspaces(id),
    name VARCHAR(255) NOT NULL,
    owner UUID REFERENCES gridwalk.users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Layers table
CREATE TABLE gridwalk.layers (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    workspace_id UUID REFERENCES gridwalk.workspaces(id),
    connection_id UUID REFERENCES gridwalk.connections(id),
    uploaded_by UUID REFERENCES gridwalk.users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX idx_workspace_members_user_id ON gridwalk.workspace_members(user_id);
CREATE INDEX idx_projects_workspace_id ON gridwalk.projects(workspace_id);
CREATE INDEX idx_layers_workspace_id ON gridwalk.layers(workspace_id);
CREATE INDEX idx_connection_access_workspace_id ON gridwalk.connection_access(workspace_id);
