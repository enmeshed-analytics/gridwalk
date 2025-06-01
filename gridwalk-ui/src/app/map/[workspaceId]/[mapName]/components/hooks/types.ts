import { WorkspaceConnection } from "../sidebars/types";

export interface LayerInfo {
  workspace_id: string;
  name: string;
  file_type?: string;
}

export interface UploadResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
    workspace_id: string;
  };
  error?: string;
  chunkInfo?: {
    currentChunk: number;
    totalChunks: number;
  };
}

export interface FileHandlerResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
    workspace_id: string;
  };
}

export interface OSAPIResponse {
  type: string;
  features: Array<{
    type: string;
    geometry: GeoJSON.Geometry;
    properties: Record<string, unknown>;
    id?: string;
  }>;
  links?: Array<{
    href: string;
    rel: string;
    type?: string;
  }>;
  numberReturned?: number;
  numberMatched?: number;
}

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
  width: number;
  height: number;
  center: {
    lng: number;
    lat: number;
  };
}

export interface Annotation extends GeoJSON.Feature {
  id: string;
  properties: {
    type?: "square" | "hexagon" | "circle" | "line" | "polygon" | "point";
    style?: {
      color: string;
      opacity: number;
      width?: number;
      radius?: number;
    };
  };
}

export interface AnnotationsProps {
  mapRef?: React.MutableRefObject<maplibregl.Map | null>;
  isMapReady?: boolean;
  onDrawComplete?: () => void;
  apiUrl?: string;
}

export interface SelectedFeature {
  id: string | number | undefined;
  layerId: string;
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry;
}

export interface UseFeatureSelectionProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
  isMapReady: boolean;
  onFeatureClick?: (feature: SelectedFeature | null) => void;
  osApiFeatures?: GeoJSON.Feature[];
}

export interface UseFileUploaderProps {
  fileName: string;
  workspaceId: string;
  setUploadError: (error: string | null) => void;
  setUploadSuccess: (success: boolean) => void;
  setUploadProgress: (progress: number) => void;
  setIsUploading: (isUploading: boolean) => void;
  setWorkspaceConnections: (connections: WorkspaceConnection[]) => void;
  handleModalClose: () => void;
}

export type LayerConfigType =
  | {
      type: "line";
      paint: {
        "line-color": string;
        "line-opacity": number;
        "line-width": number;
      };
    }
  | {
      type: "fill";
      paint: {
        "fill-color": string;
        "fill-opacity": number;
        "fill-outline-color": string;
      };
    }
  | {
      type: "circle";
      paint: {
        "circle-color": string;
        "circle-opacity": number;
        "circle-radius": number;
      };
    };

export interface UseLayerProps {
  mapRef?: React.MutableRefObject<maplibregl.Map | null>;
  isMapReady?: boolean;
  workspaceId: string;
  selectedLayers?: { [key: number]: boolean };
  workspaceConnections?: WorkspaceConnection[];
}
