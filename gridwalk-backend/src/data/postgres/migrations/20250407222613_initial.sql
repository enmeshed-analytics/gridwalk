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
    created_at BIGINT NOT NULL
);

-- Workspaces table
CREATE TABLE gridwalk.workspaces (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner UUID NOT NULL REFERENCES gridwalk.users(id),
    active BOOLEAN DEFAULT TRUE,
    created_at BIGINT NOT NULL
);

-- Workspace members (join table)
CREATE TABLE gridwalk.workspace_members (
    workspace_id UUID REFERENCES gridwalk.workspaces(id),
    user_id UUID REFERENCES gridwalk.users(id),
    role VARCHAR(50) NOT NULL,
    joined_at BIGINT NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
);

-- Connections table
CREATE TABLE gridwalk.connections (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    connector_type VARCHAR(50) NOT NULL, -- e.g., 'Postgres', 'MySQL', 'SQLite', 'GeoJSON', 'Shapefile', etc.

    -- Store all connection configuration as JSON based on connector type
    connection_config JSONB NOT NULL,

    -- Metadata
    created_at BIGINT NOT NULL,
    created_by UUID REFERENCES gridwalk.users(id),
    last_updated_at BIGINT,
    active BOOLEAN DEFAULT TRUE
);

-- Connection access rights
CREATE TABLE gridwalk.connection_access (
    workspace_id UUID REFERENCES gridwalk.workspaces(id),
    connection_id VARCHAR(255) REFERENCES gridwalk.connections(id),
    access_path VARCHAR(255) NOT NULL,
    access_variant VARCHAR(50) NOT NULL,
    PRIMARY KEY (workspace_id, connection_id, access_path, access_variant)
);

-- Projects table
CREATE TABLE gridwalk.projects (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES gridwalk.workspaces(id),
    name VARCHAR(255) NOT NULL,
    uploaded_by UUID REFERENCES gridwalk.users(id),
    created_at BIGINT NOT NULL
);

-- Layers table
CREATE TABLE gridwalk.layers (
    name VARCHAR(255) NOT NULL,
    workspace_id UUID REFERENCES gridwalk.workspaces(id),
    uploaded_by UUID REFERENCES gridwalk.users(id),
    created_at BIGINT NOT NULL,
    PRIMARY KEY (name, workspace_id)
);

-- Create indexes for common query patterns
CREATE INDEX idx_workspace_members_user_id ON gridwalk.workspace_members(user_id);
CREATE INDEX idx_projects_workspace_id ON gridwalk.projects(workspace_id);
CREATE INDEX idx_layers_workspace_id ON gridwalk.layers(workspace_id);
CREATE INDEX idx_connection_access_workspace_id ON gridwalk.connection_access(workspace_id);
