"use client";

import { useCallback } from "react";
import { getUploadHeaders } from "../actions/uploadFile";
import { ChunkInfo, LayerInfo } from "./types";

const CHUNK_SIZE = 15 * 1024 * 1024; // 15MB chunks

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
  const getWorkspaceIdFromUrl = () => {
    const path = window.location.pathname;
    const parts = path.split("/");
    const projectIndex = parts.indexOf("project");
    if (projectIndex === -1 || !parts[projectIndex + 1]) {
      throw new Error("Project ID is required but missing from URL");
    }
    return parts[projectIndex + 1];
  };

  const uploadFile = useCallback(
    async (
      file: File,
      _workspaceId: string,
      onProgress?: (progress: number) => void,
      onSuccess?: (data: UploadResponse) => void,
      onError?: (error: string) => void
    ): Promise<void> => {
      const currentWorkspaceId = getWorkspaceIdFromUrl();
      try {
        const baseHeaders = await getUploadHeaders();
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        let finalResponse = null;

        for (let currentChunk = 0; currentChunk < totalChunks; currentChunk++) {
          const start = currentChunk * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const extension = "." + file.name.split(".").pop()?.toLowerCase();

          // Create layer info object matching backend expectations
          const layerInfo: LayerInfo = {
            workspace_id: currentWorkspaceId,
            name: file.name,
            file_type: file.name.split(".").pop()?.toLowerCase(),
          };

          // Create chunk info object matching backend expectations
          const chunkInfo: ChunkInfo = {
            currentChunk,
            totalChunks,
            fileSize: file.size,
          };

          const formData = new FormData();
          formData.append("file", chunk, file.name);
          formData.append("layer_info", JSON.stringify(layerInfo));
          formData.append("chunk_info", JSON.stringify(chunkInfo));

          // Headers matching backend expectations
          const headers = {
            Authorization: baseHeaders.Authorization,
            "X-File-Type": extension,
            "X-Workspace-Id": currentWorkspaceId,
            "X-Chunk-Number": currentChunk.toString(),
            "X-Total-Chunks": totalChunks.toString(),
            "X-File-Size": file.size.toString(),
          };

          console.log(headers);

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_GRIDWALK_API}/upload_layer`,
            {
              method: "POST",
              headers,
              body: formData,
              credentials: "include",
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              JSON.stringify({
                error: errorText,
                chunkInfo,
                status: response.status,
              })
            );
          }

          const data = await response.json();

          const progress = Math.round(((currentChunk + 1) / totalChunks) * 100);
          onProgress?.(progress);

          if (currentChunk === totalChunks - 1) {
            finalResponse = data;
          }
        }

        if (finalResponse) {
          console.log(
            "Upload completed, calling success callback",
            finalResponse
          );
          onSuccess?.({
            success: true,
            data: finalResponse,
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        onError?.(errorMessage);
        console.error("Upload error:", err);
      }
    },
    []
  );

  return { uploadFile };
};
