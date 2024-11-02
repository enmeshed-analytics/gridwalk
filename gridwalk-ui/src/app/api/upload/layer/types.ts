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
