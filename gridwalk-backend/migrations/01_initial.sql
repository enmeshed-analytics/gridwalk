CREATE SCHEMA app_data;

-- Trigger to auto-update `updated_at`
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table to store application settings
CREATE TABLE app_data.app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL
);

-- Enum for user status
CREATE TYPE app_data.user_status AS ENUM (
    'pending_approval',
    'active_pending_verification',
    'active',
    'inactive',
    'suspended',
    'archived'
);

-- Table to store user information
CREATE TABLE app_data.users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    global_role VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status app_data.user_status NOT NULL DEFAULT 'active_pending_verification',
    CHECK (global_role IS NULL OR global_role <> '')
);
CREATE INDEX idx_users_email ON app_data.users(email);

-- Table to store user notes separately for performance
CREATE TABLE app_data.user_notes (
    user_id UUID PRIMARY KEY REFERENCES app_data.users (id) ON DELETE CASCADE,
    notes JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_data.user_passwords (
    user_id UUID PRIMARY KEY REFERENCES app_data.users (id) ON DELETE CASCADE,
    hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table to store verification codes
CREATE TABLE app_data.verification_codes (
    id UUID PRIMARY KEY,  -- This serves as the verification token
    user_id UUID NOT NULL REFERENCES app_data.users (id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, id)
);
CREATE INDEX idx_verification_codes_expires_at ON app_data.verification_codes (expires_at);
CREATE INDEX idx_verification_codes_user_id ON app_data.verification_codes (user_id);

CREATE TRIGGER update_user_updated_at
BEFORE UPDATE ON app_data.users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notes_updated_at
BEFORE UPDATE ON app_data.user_notes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Sessions table
-- TODO: Add extra info for session management
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES app_data.users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
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
    user_id UUID REFERENCES app_data.users(id),
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
    owner UUID REFERENCES app_data.users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Layers table
CREATE TABLE layers (
    id UUID PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id),
    connection_id UUID REFERENCES connections(id),
    name VARCHAR(255) NOT NULL,
    uploaded_by UUID REFERENCES app_data.users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX idx_maps_workspace_id ON maps(workspace_id);
CREATE INDEX idx_layers_workspace_id ON layers(workspace_id);
CREATE INDEX idx_connection_access_workspace_id ON connection_access(workspace_id);
