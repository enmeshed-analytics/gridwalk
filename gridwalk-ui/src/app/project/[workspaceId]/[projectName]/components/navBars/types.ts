/* Navigation Bar Items */
export interface MainMapNav {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  children?: React.ReactNode;
}

export interface Source {
  name: string;
}

export type WorkspaceConnection = {
  id: string;
  layer: string;
  sources: Source[];
};

/* Simple Modal Prop Elements */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavItemClick: (item: MainMapNav) => void;
  selectedItem: MainMapNav | null;
  onLayerUpload: (file: File) => void;
  onLayerDelete: (id: string) => void;
  isUploading: boolean;
  error: string | null;
  uploadSuccess: boolean;
  uploadProgress: number;
  onAbortUpload: () => void;
  layers: LayerUpload[];
  selectedFile: File | null;
  fileName: string;
  onFileSelection: (file: File) => void;
  onFileNameChange: (name: string) => void;
  onCancelSelection: () => void;
  workspaceConnections: WorkspaceConnection[];
  mapRef: React.RefObject<maplibregl.Map | null>;
  selectedLayers: { [key: number]: boolean };
  onLayerToggle: (index: number, connection: WorkspaceConnection) => void;
}

/* Map Edit Items */
export interface MapEditNav {
  id: string;
  title: string;
  icon?: string;
  description: string;
}

/* Base Layer Items */
export interface BaseEditNav {
  id: string;
  title: string;
  icon?: string;
  description: string;
}

/* Base Layer Nav Props */
export interface BaseLayerNavProps {
  onBaseItemClick: (item: BaseEditNav) => void;
  selectedBaseItem: BaseEditNav | null;
}

/* Upload Layer */
export interface LayerUpload {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
}
