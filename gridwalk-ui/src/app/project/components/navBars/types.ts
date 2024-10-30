/* Navigation Bar Items */
export interface MainMapNav {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  children?: React.ReactNode;
}

/* Simple Modal Prop Elements */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavItemClick: (item: MainMapNav) => void;
  selectedItem: MainMapNav | null;
  // layers: LayerUpload[];
  onLayerUpload: (file: File) => Promise<void>;
  onLayerDelete: (layerId: string) => void;
  isUploading: boolean;
  error: string | null;
  uploadSuccess: boolean;
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

/* Upload Layer */
export interface LayerUpload {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
}
