export type ApiResponse = {
  status: string;
  data: string[];
  error: string | null;
};

export interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}
