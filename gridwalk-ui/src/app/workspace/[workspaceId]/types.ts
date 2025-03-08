export interface ApiResponse {
  workspace_id: string;
  id: string;
  name: string;
  uploaded_by: string;
  created_at: number;
}

export interface CreateMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export interface DeleteMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapId: string;
  mapName: string;
  onConfirm: () => Promise<void>;
}

export interface AddWorkspaceMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: "Admin" | "Read") => Promise<void>;
}

export interface ViewWorkspaceConnectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export interface ViewWorkspaceMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export interface Project {
  workspace_id: string;
  id: string;
  name: string;
  uploaded_by: string;
  created_at: number;
}

export interface WorkspaceProjectsClientProps {
  workspaceId: string;
  initialProjects: Project[];
}
