export interface ApiResponse {
  workspace_id: string;
  id: string;
  name: string;
  uploaded_by: string;
  created_at: number;
}

export interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}
