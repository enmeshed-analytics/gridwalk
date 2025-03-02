export interface MainSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onItemClick: (item: MainSidebarModalOptions) => void;
  selectedItem: MainSidebarModalOptions | null;
  onLayerUpload: (file: File) => void;
  isUploading: boolean;
  error: string | null;
  uploadSuccess: boolean;
  uploadProgress: number;
  onAbortUpload: () => void;
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

export interface MainSidebarModalOptions {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  children?: React.ReactNode;
}

export interface MapEditSidebarModalOptions {
  id: string;
  title: string;
  icon?: string;
  description: string;
}

export interface MapEditsProps {
  onEditItemClick: (item: MapEditSidebarModalOptions) => void;
  selectedEditItem: MapEditSidebarModalOptions | null;
}

export interface BaseLayerSidebarModalOptions {
  id: string;
  title: string;
  icon?: string;
  description: string;
}

export interface BaseLayerSidebarProps {
  onBaseItemClick: (item: BaseLayerSidebarModalOptions) => void;
  selectedBaseItem: BaseLayerSidebarModalOptions | null;
}

export interface SourceProps {
  name: string;
}

export type WorkspaceConnection = {
  id: string;
  layer: string;
  sources: SourceProps[];
};
