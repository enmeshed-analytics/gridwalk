"use client";

import { useCallback } from "react";
import { getUploadHeaders } from "../../actions/auth";
import { LayerInfo, UploadResponse } from "./types";
import JSZip from "jszip";

const CHUNK_SIZE = 10 * 1024 * 1024;

const getWorkspaceIdFromUrl = () => {
  const path = window.location.pathname;
  const parts = path.split("/");
  const projectIndex = parts.indexOf("project");
  if (projectIndex === -1 || !parts[projectIndex + 1]) {
    throw new Error("Workspace ID is required but missing from URL");
  }
  return parts[projectIndex + 1];
};

export const useSingleFileUploader = () => {
  const uploadSingleFile = useCallback(
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

          const chunk = new Blob([file.slice(start, end)], {
            type: file.type || "application/octet-stream",
          });

          const formData = new FormData();
          formData.append("file", chunk, file.name);

          // Only send layer_info with the final chunk
          if (currentChunk === totalChunks - 1) {
            const layerInfo: LayerInfo = {
              workspace_id: currentWorkspaceId,
              name: file.name,
              file_type: file.name.split(".").pop()?.toLowerCase(),
            };
            formData.append("layer_info", JSON.stringify(layerInfo));
          }

          const headers = {
            Authorization: baseHeaders.Authorization,
            "X-File-Type": "." + file.name.split(".").pop()?.toLowerCase(),
            "X-Workspace-Id": currentWorkspaceId,
            "X-Chunk-Number": currentChunk.toString(),
            "X-Total-Chunks": totalChunks.toString(),
            "X-File-Size": file.size.toString(),
          };

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_GRIDWALK_API}/upload_layer_v2`,
            {
              method: "POST",
              headers,
              body: formData,
              credentials: "include",
            }
          );

          if (!response.ok) {
            throw new Error(await response.text());
          }

          const data = await response.json();
          onProgress?.(Math.round(((currentChunk + 1) / totalChunks) * 100));

          if (currentChunk === totalChunks - 1) {
            finalResponse = data;
          }
        }

        if (finalResponse) {
          onSuccess?.({
            success: true,
            data: finalResponse,
          });
        }
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Unknown error");
        console.error("Upload error:", err);
      }
    },
    []
  );
  return { uploadSingleFile };
};

export const useShapefileUploader = () => {
  const uploadShapefile = useCallback(
    async (
      file: File,
      _workspaceId: string,
      onProgress?: (progress: number) => void,
      onSuccess?: (data: UploadResponse) => void,
      onError?: (error: string) => void
    ): Promise<void> => {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        onError?.("Please upload a ZIP file containing shapefile components");
        return;
      }

      try {
        // Validate zip contents first
        const zip = new JSZip();
        const arrayBuffer = await file.arrayBuffer();
        const zipContents = await zip.loadAsync(arrayBuffer);

        // Check for required shapefile components
        const requiredExtensions = ["shp", "dbf", "shx"];
        const foundExtensions = new Set<string>();

        zipContents.forEach((relativePath) => {
          const extension = relativePath.split(".").pop()?.toLowerCase();
          if (extension) foundExtensions.add(extension);
        });

        const missingFiles = requiredExtensions.filter(
          (ext) => !foundExtensions.has(ext)
        );
        if (missingFiles.length > 0) {
          onError?.(
            `Missing required shapefile components: ${missingFiles.join(", ")}`
          );
          return;
        }

        // Proceed with chunked upload
        const currentWorkspaceId = getWorkspaceIdFromUrl();
        const baseHeaders = await getUploadHeaders();
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        let finalResponse = null;

        for (let currentChunk = 0; currentChunk < totalChunks; currentChunk++) {
          const start = currentChunk * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);

          const chunk = new Blob([file.slice(start, end)], {
            type: "application/zip",
          });

          const formData = new FormData();
          formData.append("file", chunk, file.name);

          // Only send layer_info with the final chunk
          if (currentChunk === totalChunks - 1) {
            const layerInfo: LayerInfo = {
              workspace_id: currentWorkspaceId,
              name: file.name,
              file_type: "shapefile",
            };
            formData.append("layer_info", JSON.stringify(layerInfo));
          }

          const headers = {
            Authorization: baseHeaders.Authorization,
            "X-File-Type": "shapefile",
            "X-Workspace-Id": currentWorkspaceId,
            "X-Chunk-Number": currentChunk.toString(),
            "X-Total-Chunks": totalChunks.toString(),
            "X-File-Size": file.size.toString(),
          };

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_GRIDWALK_API}/upload_layer_v2`,
            {
              method: "POST",
              headers,
              body: formData,
              credentials: "include",
            }
          );

          if (!response.ok) {
            throw new Error(await response.text());
          }

          const data = await response.json();
          onProgress?.(Math.round(((currentChunk + 1) / totalChunks) * 100));

          if (currentChunk === totalChunks - 1) {
            finalResponse = data;
          }
        }

        if (finalResponse) {
          onSuccess?.({
            success: true,
            data: finalResponse,
          });
        }
      } catch (err) {
        onError?.(
          err instanceof Error ? err.message : "Error processing ZIP file"
        );
        console.error("Upload error:", err);
      }
    },
    []
  );

  return { uploadShapefile };
};
