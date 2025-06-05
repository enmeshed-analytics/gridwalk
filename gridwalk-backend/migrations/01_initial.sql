CREATE SCHEMA gridwalk;
SET search_path TO gridwalk, public;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    global_role VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User passwords
CREATE TABLE user_passwords (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
-- TODO: Add extra info for session management
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Workspaces table
CREATE TABLE workspaces (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Workspace members (join table)
CREATE TABLE workspace_members (
    workspace_id UUID REFERENCES workspaces(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(50) NOT NULL, -- e.g., 'admin', 'editor', 'viewer'
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, user_id)
);

-- Connections table
CREATE TABLE connections (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tenancy VARCHAR(50) NOT NULL, -- e.g., 'shared', 'private'
    shared_capacity INTEGER, -- set if tenancy is 'shared'
    workspace_id UUID, -- set if tenancy is 'workspace'
    connector_type VARCHAR(50) NOT NULL, -- e.g., 'Postgres', 'MySQL', 'SQLite', 'GeoJSON', 'Shapefile', etc.

    -- Store all connection configuration as JSON based on connector type
    config JSONB NOT NULL,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE

    -- Add a check constraint to ensure data consistency.
    CONSTRAINT tenancy_valid CHECK (
         (tenancy = 'shared' AND shared_capacity IS NOT NULL AND workspace_id IS NULL)
      OR (tenancy = 'workspace' AND workspace_id IS NOT NULL AND shared_capacity IS NULL)
    )
);

-- Connection access rights - No data/layer sharing information is stored here
CREATE TABLE connection_access (
    workspace_id UUID REFERENCES workspaces(id),
    connection_id UUID REFERENCES connections(id),
    PRIMARY KEY (workspace_id, connection_id)
);

-- Maps table
CREATE TABLE maps (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    name VARCHAR(255) NOT NULL,
    owner UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Layers table
CREATE TABLE layers (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    connection_id UUID REFERENCES connections(id),
    name VARCHAR(255) NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX idx_maps_workspace_id ON maps(workspace_id);
CREATE INDEX idx_layers_workspace_id ON layers(workspace_id);
CREATE INDEX idx_connection_access_workspace_id ON connection_access(workspace_id);
