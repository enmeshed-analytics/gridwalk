"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useMapInit } from "./mapInit";
import MainMapNavigation from "./navBars/mainSidebar";
import MapEditNavigation from "./navBars/mapEditSidebar";
import BaseLayerNavigation from "./navBars/baseLayerSidebar";
import { useFileUploader } from "./hooks/fileUpload";
import { MainMapNav, MapEditNav, BaseEditNav } from "./navBars/types";
import { useParams } from "next/navigation";
import {
  getWorkspaceConnections,
  WorkspaceConnection,
} from "./actions/getSources";

export interface LayerUpload {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  workspace_id?: string;
}

const defaultBaseLayer: BaseEditNav = {
  id: "light",
  title: "Light Mode",
  icon: "light",
  description: "Light blue base map style",
};

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

interface MapClientProps {
  apiUrl: string;
}

export function MapClient({ apiUrl }: MapClientProps) {
  const [workspaceConnections, setWorkspaceConnections] = useState<
    WorkspaceConnection[]
  >([]);
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  // UI States
  const [selectedItem, setSelectedItem] = useState<MainMapNav | null>(null);
  const [selectedEditItem, setSelectedEditItem] = useState<MapEditNav | null>(
    null
  );
  const [selectedBaseItem, setSelectedBaseItem] =
    useState<BaseEditNav>(defaultBaseLayer); // Initialize with defaultBaseLayer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<string>(MAP_STYLES.light);

  // Layer Management States
  const [layers, setLayers] = useState<LayerUpload[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // File Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  // Active Layers State
  const activeLayerIds = useRef<string[]>([]);
  const [selectedLayers, setSelectedLayers] = useState<{
    [key: number]: boolean;
  }>({});

  // Map Initialisation
  const {
    mapContainer,
    map: mapRef,
    mapError,
  } = useMapInit({
    ...INITIAL_MAP_CONFIG,
    styleUrl: currentStyle,
    apiUrl,
  });

  // File Selection Handler
  const handleFileSelection = useCallback((file: File) => {
    setSelectedFile(file);
    setUploadError(null);
  }, []);

  // File Upload Hook Integration
  const { uploadFile } = useFileUploader();

  // File Upload Handler
  const handleUpload = useCallback(
    async (fileToUpload: File) => {
      if (!fileToUpload || !fileName.trim()) {
        setUploadError("Please provide a valid file and name");
        return;
      }

      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(false);
      setUploadProgress(0);

      try {
        // Create a new File object with the custom name while preserving the extension
        const extension = fileToUpload.name.split(".").pop();
        const renamedFile = new File(
          [fileToUpload],
          `${fileName}${extension ? `.${extension}` : ""}`,
          { type: fileToUpload.type }
        );

        await uploadFile(
          renamedFile,
          "",
          (progress) => {
            setUploadProgress(progress);
          },
          async (response) => {
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

              // Refresh workspace layers upon successfull upload
              try {
                const connections = await getWorkspaceConnections(workspaceId);
                setWorkspaceConnections(connections);
              } catch (error) {
                console.error(
                  "Failed to refresh workspace connections:",
                  error
                );
              }

              setUploadSuccess(true);
              setIsUploading(false);
              setSelectedFile(null);
              setFileName("");

              setTimeout(() => {
                setUploadSuccess(false);
              }, 2000);
            }
          },
          (error) => {
            setUploadError(error);
          }
        );
      } finally {
        setIsUploading(false);
      }
    },
    [uploadFile, fileName, workspaceId]
  );

  // Abort Upload Handler
  const handleAbortUpload = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError("Upload cancelled");
    setSelectedFile(null);
    setFileName("");
  }, []);

  // Cancel File Selection
  const handleCancelSelection = useCallback(() => {
    setSelectedFile(null);
    setFileName("");
    setUploadError(null);
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
    setUploadSuccess(false);
    setUploadError(null);
    setSelectedFile(null);
    setFileName("");
  }, []);

  useEffect(() => {
    const fetchWorkspaceConnections = async () => {
      try {
        const connections = await getWorkspaceConnections(workspaceId);
        setWorkspaceConnections(connections);
      } catch (error) {
        console.error("Failed to fetch workspace connections:", error);
      }
    };

    fetchWorkspaceConnections();
  }, [workspaceId]);

  // Layer management handler
  const addMapLayer = useCallback(
    (
      map: maplibregl.Map,
      layerId: string,
      sourceUrl: string,
      sourceLayerName: string
    ) => {
      if (!map.getSource(layerId)) {
        map.addSource(layerId, {
          type: "vector",
          tiles: [sourceUrl],
          minzoom: 0,
          maxzoom: 22,
        });
      }

      map.addLayer({
        id: layerId,
        type: "line",
        source: layerId,
        "source-layer": sourceLayerName,
        paint: {
          "line-color": "#0080ff",
          "line-opacity": 1,
        },
      });
    },
    []
  );

  const removeMapLayer = useCallback((map: maplibregl.Map, layerId: string) => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(layerId)) {
      map.removeSource(layerId);
    }
  }, []);

  const handleLayerToggle = useCallback(
    (index: number, connection: WorkspaceConnection) => {
      if (!mapRef?.current) return;
      const map = mapRef.current;
      const layerName = String(connection);
      const layerId = `layer-${workspaceId}-${layerName}`;
      const willBeEnabled = !selectedLayers[index];

      setSelectedLayers((prev) => ({
        ...prev,
        [index]: willBeEnabled,
      }));

      if (willBeEnabled) {
        try {
          const sourceLayerName = layerName;
          console.log("Source layer name:", sourceLayerName);

          const url = new URL(window.location.href);
          const pathParts = url.pathname.split("/");
          const workspaceIdFromUrl = pathParts[2];

          const sourceUrl = `${process.env.NEXT_PUBLIC_GRIDWALK_API}/workspaces/${workspaceIdFromUrl}/connections/primary/sources/${layerName}/tiles/{z}/{x}/{y}`;

          addMapLayer(map, layerId, sourceUrl, sourceLayerName);
          activeLayerIds.current.push(layerId);
        } catch (err) {
          setSelectedLayers((prev) => ({
            ...prev,
            [index]: false,
          }));
          console.error("Error adding layer:", err);
        }
      } else {
        try {
          removeMapLayer(map, layerId);
          activeLayerIds.current = activeLayerIds.current.filter(
            (id) => id !== layerId
          );
        } catch (err) {
          console.error("Error removing layer:", err);
        }
      }
    },
    [mapRef, workspaceId, selectedLayers, addMapLayer, removeMapLayer]
  );

  // Cleanup effect for layers
  useEffect(() => {
    // Capture the ref value when the effect starts
    const currentMap = mapRef?.current;

    return () => {
      // Use the captured value in cleanup
      if (!currentMap) return;

      const layerIdsToCleanup = [...activeLayerIds.current];

      layerIdsToCleanup.forEach((layerId: string) => {
        try {
          if (currentMap.getLayer(layerId)) {
            currentMap.removeLayer(layerId);
          }
          if (currentMap.getSource(layerId)) {
            currentMap.removeSource(layerId);
          }
        } catch (err) {
          console.error("Error cleaning up layer:", err);
        }
      });
    };
  }, [mapRef]); // mapRef is still in deps

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
        selectedFile={selectedFile}
        fileName={fileName}
        onFileSelection={handleFileSelection}
        onFileNameChange={setFileName}
        onCancelSelection={handleCancelSelection}
        workspaceConnections={workspaceConnections}
        mapRef={mapRef}
        selectedLayers={selectedLayers}
        onLayerToggle={handleLayerToggle}
      />
      <BaseLayerNavigation
        onBaseItemClick={handleBaseItemClick}
        selectedBaseItem={selectedBaseItem}
      />
    </div>
  );
}
