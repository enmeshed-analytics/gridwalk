// FILE UPLOAD
export interface LayerProps {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  workspace_id?: string;
}

export type SupportedFileTypes =
  | "zip"
  | "gpkg"
  | "xlsx"
  | "parquet"
  | "json"
  | "geojson"
  | "csv";

export interface FileHandlerResponse {
  success: boolean;
  data?: {
    id: string;
    name: string;
    workspace_id: string;
  };
}

// MAP CONFIGS
export const MAP_STYLES = {
  light: "/OS_VTS_3857_Light.json",
  dark: "/OS_VTS_3857_Dark.json",
  car: "/OS_VTS_3857_Road.json",
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;

export const INITIAL_MAP_CONFIG = {
  center: [-0.1278, 51.5074] as [number, number],
  zoom: 11,
} as const;

export interface MapClientProps {
  apiUrl: string;
}

export interface LayerStyle {
  color: string;
  opacity: number;
  radius?: number;
  width?: number;
}

export interface LayerConfig {
  layerId: string;
  geomType: string;
  style: LayerStyle;
}
