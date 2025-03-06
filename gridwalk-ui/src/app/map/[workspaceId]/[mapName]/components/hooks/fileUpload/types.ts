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
