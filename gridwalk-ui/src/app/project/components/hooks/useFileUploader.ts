import { useCallback } from "react";

const CHUNK_SIZE = 15 * 1024 * 1024; // 15MB chunks
const DEFAULT_WORKSPACE = "d068ebc4-dc32-4929-ac55-869e04bfb269";

interface UploadResponse {
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

export const useFileUploader = () => {
  // Only keep the chunk upload logic
  const uploadFile = useCallback(
    async (
      file: File,
      workspaceId: string = DEFAULT_WORKSPACE,
      onProgress?: (progress: number) => void,
      onSuccess?: (data: UploadResponse) => void,
      onError?: (error: string) => void,
    ): Promise<void> => {
      try {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        for (let currentChunk = 0; currentChunk < totalChunks; currentChunk++) {
          const start = currentChunk * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          const formData = new FormData();
          formData.append("file", chunk, file.name);
          formData.append("workspace_id", workspaceId);
          formData.append("name", file.name);
          formData.append(
            "chunk_info",
            JSON.stringify({
              currentChunk,
              totalChunks,
              fileSize: file.size,
            }),
          );

          const response = await fetch("/api/upload/layer", {
            method: "POST",
            body: formData,
          });

          const data = (await response.json()) as UploadResponse;

          if (!response.ok || !data.success) {
            throw new Error(data.error || `Upload failed: ${response.status}`);
          }

          // Call progress callback
          const progress = Math.round(((currentChunk + 1) / totalChunks) * 100);
          onProgress?.(progress);

          // If this was the last chunk
          if (currentChunk === totalChunks - 1) {
            onSuccess?.(data);
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        onError?.(errorMessage);
        console.error("Upload error:", err);
      }
    },
    [],
  );

  return { uploadFile };
};
