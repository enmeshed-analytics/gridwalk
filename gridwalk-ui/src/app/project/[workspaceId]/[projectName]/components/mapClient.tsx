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
  description: "Light base map style",
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
  // Connections state
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
    useState<BaseEditNav>(defaultBaseLayer);
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
  const initialLoadComplete = useRef(false);

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

  // Layer Delete
  const handleLayerDelete = useCallback((layerId: string) => {
    setLayers((prev) => prev.filter((layer) => layer.id !== layerId));
  }, []);

  // MAIN SIDEBAR
  const handleNavItemClick = useCallback((item: MainMapNav) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  }, []);

  // TOP SIDEBAR
  const handleEditItemClick = useCallback((item: MapEditNav) => {
    setSelectedEditItem((prev) => (prev?.id === item.id ? null : item));
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
        type: "circle",
        source: layerId,
        "source-layer": sourceLayerName,
        paint: {
          "circle-color": "#0080ff",
          "circle-opacity": 0.5,
        },
      });
    },
    []
  );

  // BASE LAYER SIDEBAR BOTTOM RIGHT
  const handleBaseItemClick = useCallback(
    (item: BaseEditNav) => {
      if (!mapRef.current) return;
      console.log("Active layers before style change:", activeLayerIds.current);

      // GET CURRENT ACTIVE LAYERS
      const currentLayerConfigs = activeLayerIds.current.map((layerId) => {
        const layerName = layerId.replace(`layer-${workspaceId}-`, "");
        return {
          layerId,
          layerName,
          sourceUrl: `${process.env.NEXT_PUBLIC_GRIDWALK_API}/workspaces/${workspaceId}/connections/primary/sources/${layerName}/tiles/{z}/{x}/{y}`,
        };
      });

      setSelectedBaseItem(item);
      const styleKey = item.id as MapStyleKey;

      if (styleKey in MAP_STYLES) {
        const map = mapRef.current;
        let hasRestoredLayers = false;

        // SET UP EVENT LISTENERS
        // THIS BASICALLY WAITS FOR MAP TO BE IN IDLE STATE AFTER STYLE CHANGE TO THEN RELOAD THE LAYERS
        const setupStyleLoadHandlers = () => {
          console.log("Setting up style load handlers");

          const handleIdle = () => {
            if (map.isStyleLoaded() && !hasRestoredLayers) {
              console.log("Style is loaded, restoring layers");
              restoreLayers();
              hasRestoredLayers = true;

              map.off("idle", handleIdle);
            }
          };

          map.on("idle", handleIdle);

          // Cleanup after timeout just in case
          setTimeout(() => {
            map.off("idle", handleIdle);
          }, 5000);
        };

        // RESTORE LAYER FUNCTION
        // TRIGGERRED BY IDLE
        const restoreLayers = () => {
          currentLayerConfigs.forEach(({ layerId, layerName, sourceUrl }) => {
            try {
              console.log(`Adding layer: ${layerName}`);
              if (!map.getSource(layerId)) {
                addMapLayer(map, layerId, sourceUrl, layerName);
                console.log(`Layer ${layerName} added successfully`);
              }
            } catch (error) {
              console.error(`Error adding layer ${layerName}:`, error);
            }
          });
        };

        // SET UP LISTENERS
        setupStyleLoadHandlers();

        // FETCH THE STYLES TO BE CHANGED
        fetch(MAP_STYLES[styleKey])
          .then((response) => response.json())
          .then((styleJson) => {
            console.log("Fetched new style, applying...");
            map.setStyle(styleJson);
            setCurrentStyle(MAP_STYLES[styleKey]);
          })
          .catch((error) => {
            console.error("Error loading style:", error);
          });
      }
    },
    [addMapLayer, workspaceId, mapRef]
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

      localStorage.setItem(
        "selectedLayers",
        JSON.stringify({
          ...selectedLayers,
          [index]: willBeEnabled,
        })
      );

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

  // Effect to load active layers back onto the map after page refresh
  useEffect(() => {
    if (!initialLoadComplete.current && isMapReady && mapRef.current) {
      const savedLayers = localStorage.getItem("selectedLayers");
      if (savedLayers) {
        try {
          const parsed = JSON.parse(savedLayers);
          setSelectedLayers(parsed);

          Object.entries(parsed).forEach(([index, isSelected]) => {
            if (isSelected && workspaceConnections[Number(index)]) {
              handleLayerToggle(
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
    handleLayerToggle,
    selectedLayers,
    isMapReady,
    mapRef,
  ]);

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
  }, [mapRef]);

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
