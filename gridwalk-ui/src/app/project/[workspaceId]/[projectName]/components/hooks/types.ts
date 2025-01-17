export interface LayerInfo {
  workspace_id: string;
  name: string;
  file_type?: string;
}

export interface FileConfig {
  maxSize: number;
  contentType: string;
  originalType?: string;
}

export type FileConfigs = {
  readonly [key: string]: FileConfig;
};

export interface ChunkInfo {
  currentChunk: number;
  totalChunks: number;
  fileSize: number;
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

export type SupportedFileTypes =
  | "zip"
  | "gpkg"
  | "xlsx"
  | "parquet"
  | "json"
  | "geojson";

export interface ChunkMetadata {
  index: number;
  total: number;
  size: number;
  originalName: string;
  fileType: SupportedFileTypes;
  checksum?: string;
}

export interface UploadChunk {
  chunk: Blob;
  metadata: ChunkMetadata;
}

export interface FileTypeHandler {
  validate: (file: File) => Promise<boolean>;
  process: (chunk: Blob) => Promise<Blob>;
}
