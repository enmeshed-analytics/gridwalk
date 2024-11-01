"use client";
import React, { useState, useCallback } from "react";
import { useMapInit } from "./components/mapInit/mapInit";
import MainMapNavigation from "./components/navBars/mainMapNavigation";
import MapEditNavigation from "./components/navBars/mapEditNavigation";
import BaseLayerNavigation from "./components/navBars/baseLayerNavigation";
import {
  MainMapNav,
  MapEditNav,
  BaseEditNav,
} from "./components/navBars/types";

export interface LayerUpload {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  workspace_id?: string;
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

export interface UploadProgress {
  uploaded: number;
  total: number;
  percentage: number;
}

const MAP_STYLES = {
  light: "/OS_VTS_3857_Light.json",
  dark: "/OS_VTS_3857_Dark.json",
  car: "/OS_VTS_3857_Road.json",
} as const;

type MapStyleKey = keyof typeof MAP_STYLES;

const INITIAL_MAP_CONFIG = {
  center: [-0.1278, 51.5074] as [number, number],
  zoom: 11,
} as const;

const DEFAULT_WORKSPACE = "d068ebc4-dc32-4929-ac55-869e04bfb269" as const;
const CHUNK_SIZE = 5 * 1024 * 1024;

export default function Project() {
  // STATES
  const [selectedItem, setSelectedItem] = useState<MainMapNav | null>(null);
  const [selectedEditItem, setSelectedEditItem] = useState<MapEditNav | null>(
    null,
  );
  const [selectedBaseItem, setSelectedBaseItem] = useState<BaseEditNav | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<string>(MAP_STYLES.light);
  const [layers, setLayers] = useState<LayerUpload[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // MAP CONFIG
  const { mapContainer, mapError } = useMapInit({
    ...INITIAL_MAP_CONFIG,
    styleUrl: currentStyle,
  });

  // HANDLE UPLOAD
  const handleLayerUpload = useCallback(
    async (
      file: File,
      workspaceId: string = DEFAULT_WORKSPACE,
    ): Promise<void> => {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

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

          // Update progress as a percentage (0-100)
          const progress = Math.round(((currentChunk + 1) / totalChunks) * 100);
          setUploadProgress(progress);

          // If this was the last chunk
          // Finish chunk upload
          if (currentChunk === totalChunks - 1) {
            setUploadSuccess(true);
            setTimeout(() => {
              setUploadSuccess(false);
              setUploadProgress(0);
            }, 3000);
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error during upload";
        setError(errorMessage);
        setTimeout(() => setError(null), 3000);
        console.error("Upload error:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  const handleLayerDelete = useCallback((layerId: string) => {
    setLayers((prev) => prev.filter((layer) => layer.id !== layerId));
  }, []);

  const handleNavItemClick = useCallback((item: MainMapNav) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  }, []);

  const handleEditItemClick = useCallback((item: MapEditNav) => {
    setSelectedEditItem((prev) => (prev?.id === item.id ? null : item));
  }, []);

  const handleBaseItemClick = useCallback((item: BaseEditNav) => {
    setSelectedBaseItem(item);
    const styleKey = item.id as MapStyleKey;
    if (styleKey in MAP_STYLES) {
      setCurrentStyle(MAP_STYLES[styleKey]);
    }
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedItem(null);
  }, []);

  const ErrorDisplay = mapError ? (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50">
      {mapError}
    </div>
  ) : null;

  return (
    <div className="w-full h-screen relative">
      {ErrorDisplay}

      <div className="absolute inset-0 pl-10">
        <div ref={mapContainer} className="h-full w-full" />
      </div>

      <MapEditNavigation
        onEditItemClick={handleEditItemClick}
        selectedEditItem={selectedEditItem}
      />

      <MainMapNavigation
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onNavItemClick={handleNavItemClick}
        selectedItem={selectedItem}
        onLayerUpload={handleLayerUpload}
        onLayerDelete={handleLayerDelete}
        isUploading={isUploading}
        error={error}
        uploadSuccess={uploadSuccess}
        uploadProgress={uploadProgress}
      />

      <BaseLayerNavigation
        onBaseItemClick={handleBaseItemClick}
        selectedBaseItem={selectedBaseItem}
      />
    </div>
  );
}
