"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import MainSidebar from "./sidebars/main-sidebar";
import MapEditSidebar from "./sidebars/map-edit-sidebar";
import BaseLayerSidebar from "./sidebars/base-layer-sidebar";
import {
  MainSidebarModalOptions,
  MapEditSidebarModalOptions,
  BaseLayerSidebarModalOptions,
} from "./sidebars/types";
import { useMapInit } from "./map-init";
import {
  getWorkspaceConnections,
  WorkspaceConnection,
} from "./actions/getSources";
import { useFileUploader } from "./hooks/useFileUploader";
import {
  MAP_STYLES,
  MapStyleKey,
  INITIAL_MAP_CONFIG,
  MapClientProps,
} from "./types";
import { StyleModal } from "./sidebars/layer-style-modal";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useAnnotations } from "./hooks/useAnnotations";
import { useLayer } from "./hooks/useLayer";

const defaultBaseLayer: BaseLayerSidebarModalOptions = {
  id: "light",
  title: "Light Mode",
  icon: "light",
  description: "Light base map style",
};

export function MapClient({ apiUrl }: MapClientProps) {
  // APP STATE AND FUNCTIONS
  // Connections State
  const [workspaceConnections, setWorkspaceConnections] = useState<
    WorkspaceConnection[]
  >([]);
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  // UI States
  const [selectedItem, setSelectedItem] =
    useState<MainSidebarModalOptions | null>(null);
  const [selectedEditItem, setSelectedEditItem] =
    useState<MapEditSidebarModalOptions | null>(null);
  const [selectedBaseItem, setSelectedBaseItem] =
    useState<BaseLayerSidebarModalOptions>(defaultBaseLayer);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<string>(MAP_STYLES.light);

  // File Upload States
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  // Active Layers State
  const [selectedLayers, setSelectedLayers] = useState<{
    [key: number]: boolean;
  }>({});

  // Map Initialisation
  const {
    mapContainer,
    map: mapRef,
    mapError,
    isMapReady,
  } = useMapInit({
    ...INITIAL_MAP_CONFIG,
    styleUrl: currentStyle,
    apiUrl,
  });

  // Annotations Hook
  const {
    annotations,
    selectedAnnotation,
    isStyleModalOpen: annotationsStyleModalOpen,
    setIsStyleModalOpen: setAnnotationsStyleModalOpen,
    addAnnotationLayer,
    updateAnnotationStyle,
    setSelectedAnnotation,
    setDrawMode,
  } = useAnnotations({
    mapRef,
    isMapReady,
  });

  // Layer Hook
  const {
    layerConfigs,
    selectedLayerId,
    isStyleModalOpen,
    activeLayerIds,
    setSelectedLayerId,
    setIsStyleModalOpen,
    updateLayerStyle,
    addMapLayer,
    removeMapLayer,
    handleStyleClick,
    getLayerSourceUrl,
    getLayerGeomTypeUrl,
    getLayerId,
  } = useLayer({
    mapRef,
    isMapReady,
    workspaceId,
  });

  // Initial Load Complete
  const initialLoadComplete = useRef(false);

  // Main Sidebar Modal Open
  const handleMainSidebarModalOpen = useCallback(
    (item: MainSidebarModalOptions) => {
      setSelectedItem(item);
      setIsModalOpen(true);
    },
    []
  );

  // Handle Modal Close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setUploadSuccess(false);
    setUploadError(null);
    setSelectedFile(null);
    setFileName("");
  }, []);

  // Handle File Selection
  const handleFileSelection = useCallback((file: File) => {
    setSelectedFile(file);
    setUploadError(null);
  }, []);

  // Handle File Upload
  const { handleFileUpload } = useFileUploader({
    fileName,
    workspaceId,
    setUploadError,
    setUploadSuccess,
    setUploadProgress,
    setIsUploading,
    setWorkspaceConnections,
    handleModalClose,
  });

  // Handle Abort Upload
  const handleAbortUpload = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError("Upload cancelled");
    setSelectedFile(null);
    setFileName("");
  }, []);

  // Handle Cancel Selection
  const handleCancelSelection = useCallback(() => {
    setSelectedFile(null);
    setFileName("");
    setUploadError(null);
  }, []);

  // Handle Edit Map Sidebar Click
  const handleEditMapSidebarClick = useCallback(
    (item: MapEditSidebarModalOptions) => {
      setSelectedEditItem((prev) => (prev?.id === item.id ? null : item));
    },
    []
  );

  const handleSelectLayer = useCallback(
    async (index: number, connection: WorkspaceConnection) => {
      if (!mapRef?.current) return;
      const map = mapRef.current;
      const layerName = String(connection);
      const layerId = getLayerId(layerName);
      const willBeEnabled = !selectedLayers[index];

      setSelectedLayers((prev) => ({
        ...prev,
        [index]: willBeEnabled,
      }));

      localStorage.setItem(
        "selectedLayers",
        JSON.stringify({
          ...selectedLayers,
          [index]: willBeEnabled,
        })
      );

      if (willBeEnabled) {
        try {
          const sourceUrl = getLayerSourceUrl(layerName);
          const geomTypeUrl = getLayerGeomTypeUrl(layerName);

          await addMapLayer(map, layerId, sourceUrl, layerName, geomTypeUrl);
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
        } catch (err) {
          console.error("Error removing layer:", err);
        }
      }
    },
    [
      mapRef,
      selectedLayers,
      addMapLayer,
      removeMapLayer,
      getLayerId,
      getLayerSourceUrl,
      getLayerGeomTypeUrl,
    ]
  );

  const handleBaseLayerSidebarClick = useCallback(
    (item: BaseLayerSidebarModalOptions) => {
      if (!mapRef.current) return;
      console.log("Active layers before style change:", activeLayerIds);

      setSelectedBaseItem(item);
      const styleKey = item.id as MapStyleKey;

      if (Object.keys(MAP_STYLES).includes(styleKey)) {
        const map = mapRef.current;
        let hasRestoredLayers = false;

        const setupStyleLoadHandlers = () => {
          console.log("Setting up style load handlers");

          const handleIdle = async () => {
            if (map.isStyleLoaded() && !hasRestoredLayers) {
              console.log("Style is loaded, restoring layers");

              for (const layerId of activeLayerIds) {
                const layerName = layerId.replace(`layer-${workspaceId}-`, "");
                const sourceUrl = getLayerSourceUrl(layerName);
                const geomTypeUrl = getLayerGeomTypeUrl(layerName);

                try {
                  await addMapLayer(
                    map,
                    layerId,
                    sourceUrl,
                    layerName,
                    geomTypeUrl
                  );
                } catch (error) {
                  console.error(`Error restoring layer ${layerName}:`, error);
                }
              }

              annotations.forEach((annotation) => {
                addAnnotationLayer(map, annotation);
              });

              hasRestoredLayers = true;
              map.off("idle", handleIdle);
            }
          };

          map.on("idle", handleIdle);

          setTimeout(() => {
            map.off("idle", handleIdle);
          }, 5000);
        };

        setupStyleLoadHandlers();

        fetch(MAP_STYLES[styleKey])
          .then((response) => response.json())
          .then((styleJson) => {
            console.log("Fetched new style, applying...");
            map.setStyle(styleJson, { diff: true });
            setCurrentStyle(MAP_STYLES[styleKey]);
          })
          .catch((error) => {
            console.error("Error loading style:", error);
          });
      }
    },
    [
      workspaceId,
      mapRef,
      activeLayerIds,
      addMapLayer,
      addAnnotationLayer,
      annotations,
      getLayerSourceUrl,
      getLayerGeomTypeUrl,
    ]
  );

  // Effect to fetch workspace connections
  useEffect(() => {
    const fetchWorkspaceSources = async () => {
      try {
        console.log("Fetching connections for workspace:", workspaceId);
        const connections = await getWorkspaceConnections(workspaceId);
        console.log("Received connections:", connections);
        setWorkspaceConnections(connections);
      } catch (error) {
        console.error("Failed to fetch workspace connections:", {
          workspaceId,
          error: error instanceof Error ? error.message : error,
          fullError: error,
        });
      }
    };

    if (workspaceId) {
      fetchWorkspaceSources();
    } else {
      console.warn("No workspaceId provided");
    }
  }, [workspaceId]);

  // Effect to load active layers back onto the map after page refresh
  // This uses local storage to store the selected layers and then restores them
  useEffect(() => {
    if (!initialLoadComplete.current && isMapReady && mapRef.current) {
      const savedLayers = localStorage.getItem("selectedLayers");
      if (savedLayers) {
        try {
          const parsed = JSON.parse(savedLayers);
          setSelectedLayers(parsed);

          Object.entries(parsed).forEach(([index, isSelected]) => {
            if (isSelected && workspaceConnections[Number(index)]) {
              handleSelectLayer(
                Number(index),
                workspaceConnections[Number(index)]
              );
            }
          });
        } catch (error) {
          console.error("Error restoring saved layers:", error);
        }
      }
      initialLoadComplete.current = true;
    }
  }, [
    workspaceConnections,
    handleSelectLayer,
    selectedLayers,
    isMapReady,
    mapRef,
  ]);

  // Effect to clean up layers when the map is unmounted
  useEffect(() => {
    const currentMap = mapRef?.current;

    return () => {
      if (!currentMap) return;

      activeLayerIds.forEach((layerId: string) => {
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
  }, [mapRef, activeLayerIds]);

  // Add effect to save annotations whenever they change
  useEffect(() => {
    if (annotations.length > 0) {
      localStorage.setItem("mapAnnotations", JSON.stringify(annotations));
    }
  }, [annotations]);

  // Effect to set the draw mode
  useEffect(() => {
    if (selectedEditItem) {
      setDrawMode(selectedEditItem.id);
    }
  }, [selectedEditItem, setDrawMode]);

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
      <MapEditSidebar
        onEditItemClick={handleEditMapSidebarClick}
        selectedEditItem={selectedEditItem}
      />
      <MainSidebar
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onItemClick={handleMainSidebarModalOpen}
        selectedItem={selectedItem}
        onLayerUpload={handleFileUpload}
        isUploading={isUploading}
        error={uploadError}
        uploadSuccess={uploadSuccess}
        uploadProgress={uploadProgress}
        onAbortUpload={handleAbortUpload}
        selectedFile={selectedFile}
        fileName={fileName}
        onFileSelection={handleFileSelection}
        onFileNameChange={setFileName}
        onCancelSelection={handleCancelSelection}
        workspaceConnections={workspaceConnections}
        mapRef={mapRef}
        selectedLayers={selectedLayers}
        onLayerToggle={handleSelectLayer}
        onStyleClick={handleStyleClick}
        workspaceId={workspaceId}
      />
      <BaseLayerSidebar
        onBaseItemClick={handleBaseLayerSidebarClick}
        selectedBaseItem={selectedBaseItem}
      />
      <StyleModal
        isOpen={isStyleModalOpen || annotationsStyleModalOpen}
        onClose={() => {
          setIsStyleModalOpen(false);
          setAnnotationsStyleModalOpen(false);
          setSelectedLayerId(null);
          setSelectedAnnotation(null);
        }}
        layerConfig={selectedLayerId ? layerConfigs[selectedLayerId] : null}
        annotation={selectedAnnotation}
        onStyleUpdate={(style) => {
          if (selectedLayerId) {
            updateLayerStyle(selectedLayerId, style);
          } else if (selectedAnnotation) {
            updateAnnotationStyle(selectedAnnotation.id, style);
          }
        }}
      />
    </div>
  );
}
