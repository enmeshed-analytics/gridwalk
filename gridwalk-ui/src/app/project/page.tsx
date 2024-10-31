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

// Type definitions
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
}

// Constants with strict typing
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

export default function Project() {
  // Navigation state
  const [selectedItem, setSelectedItem] = useState<MainMapNav | null>(null);
  const [selectedEditItem, setSelectedEditItem] = useState<MapEditNav | null>(
    null,
  );
  const [selectedBaseItem, setSelectedBaseItem] = useState<BaseEditNav | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<string>(MAP_STYLES.light);

  // Layer state
  const [layers, setLayers] = useState<LayerUpload[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map initialization
  const { mapContainer, mapError } = useMapInit({
    ...INITIAL_MAP_CONFIG,
    styleUrl: currentStyle,
  });

  // Upload handler with improved error handling and type safety
  // In your Project component
  const handleLayerUpload = useCallback(
    async (
      file: File,
      workspaceId: string = DEFAULT_WORKSPACE,
    ): Promise<void> => {
      setIsUploading(true);
      setError(null);

      // Add client-side validation
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB
      if (file.size > MAX_SIZE) {
        setError("File size exceeds 50MB limit");
        setIsUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspace_id", workspaceId);
      formData.append("name", file.name);

      try {
        const response = await fetch("/api/upload/layer", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json()) as UploadResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.error || `Upload failed: ${response.status}`);
        }

        // Update layers state
        if (data.data) {
          setLayers((prev) => [
            ...prev,
            {
              id: data.data!.id,
              name: data.data!.name,
              type: file.type,
              visible: true,
              workspace_id: data.data!.workspace_id,
            },
          ]);
        }

        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error during upload";
        setError(errorMessage);
        console.error("Upload error:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [setLayers],
  );

  // Event handlers with proper typing
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

  // Error UI component
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
        // layers={layers}
        onLayerUpload={handleLayerUpload}
        onLayerDelete={handleLayerDelete}
        isUploading={isUploading}
        error={error}
        uploadSuccess={uploadSuccess}
      />

      <BaseLayerNavigation
        onBaseItemClick={handleBaseItemClick}
        selectedBaseItem={selectedBaseItem}
      />
    </div>
  );
}
