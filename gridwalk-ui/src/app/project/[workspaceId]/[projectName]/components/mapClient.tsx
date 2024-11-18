'use client'
import React, { useState, useCallback } from "react"
import { useMapInit } from "./mapInit"
import MainMapNavigation from "./navBars/mainMapNavigation"
import MapEditNavigation from "./navBars/mapEditNavigation"
import BaseLayerNavigation from "./navBars/baseLayerNavigation"
import { useFileUploader } from "./hooks/useFileUploader"
import {
  MainMapNav,
  MapEditNav,
  BaseEditNav,
} from "./navBars/types"

export interface LayerUpload {
  id: string
  name: string
  type: string
  visible: boolean
  workspace_id?: string
}

const MAP_STYLES = {
  light: "/OS_VTS_3857_Light.json",
  dark: "/OS_VTS_3857_Dark.json",
  car: "/OS_VTS_3857_Road.json",
} as const

type MapStyleKey = keyof typeof MAP_STYLES

const INITIAL_MAP_CONFIG = {
  center: [-0.1278, 51.5074] as [number, number],
  zoom: 11,
} as const

interface MapClientProps {
  apiUrl: string
}

export function MapClient({ apiUrl }: MapClientProps) {
  // UI States
  const [selectedItem, setSelectedItem] = useState<MainMapNav | null>(null)
  const [selectedEditItem, setSelectedEditItem] = useState<MapEditNav | null>(null)
  const [selectedBaseItem, setSelectedBaseItem] = useState<BaseEditNav | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentStyle, setCurrentStyle] = useState<string>(MAP_STYLES.light)

  // Layer Management States
  const [layers, setLayers] = useState<LayerUpload[]>([])
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  // Map Initialization
  const { mapContainer, mapError } = useMapInit({
    ...INITIAL_MAP_CONFIG,
    styleUrl: currentStyle,
    apiUrl,
  })

  // File Upload Hook Integration
  const { uploadFile } = useFileUploader();

  // File Upload Handler
  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(false);
      setUploadProgress(0);

      try {
        await uploadFile(
          file,
          undefined,
          (progress) => {
            setUploadProgress(progress);
          },
          (response) => {
            if (response.success && response.data) {
              setLayers((prev) => [
                ...prev,
                {
                  id: response.data!.id,
                  name: response.data!.name,
                  type: "vector",
                  visible: true,
                  workspace_id: response.data!.workspace_id,
                },
              ]);
              setUploadSuccess(true);
            }
          },
          (error) => {
            setUploadError(error);
          },
        );
      } finally {
        setIsUploading(false);
      }
    },
    [uploadFile],
  );

  // Abort Upload Handler
  const handleAbortUpload = useCallback(() => {
    // Implement abort logic here if needed
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError("Upload cancelled");
  }, []);

  // Layer Management
  const handleLayerDelete = useCallback((layerId: string) => {
    setLayers((prev) => prev.filter((layer) => layer.id !== layerId));
  }, []);

  // Navigation Handlers
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

  return (
    <div className="w-full h-screen relative">
      {mapError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50">
          {mapError}
        </div>
      )}
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
        onLayerUpload={handleUpload}
        onLayerDelete={handleLayerDelete}
        isUploading={isUploading}
        error={uploadError}
        uploadSuccess={uploadSuccess}
        uploadProgress={uploadProgress}
        onAbortUpload={handleAbortUpload}
        layers={layers}
      />
      <BaseLayerNavigation
        onBaseItemClick={handleBaseItemClick}
        selectedBaseItem={selectedBaseItem}
      />
    </div>
  )
}
