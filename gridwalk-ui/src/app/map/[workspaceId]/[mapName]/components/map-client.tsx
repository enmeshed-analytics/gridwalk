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
import { FeatureModal } from "./sidebars/feature-modal";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useAnnotations } from "./hooks/useAnnotations";
import { useLayer } from "./hooks/useLayer";
import { useFeatureSelection } from "./hooks/useFeatureSelection";

const defaultBaseLayer: BaseLayerSidebarModalOptions = {
  id: "light",
  title: "Light Mode",
  icon: "light",
  description: "Light base map style",
};

export function MapClient({ apiUrl }: MapClientProps) {
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
    useState<BaseLayerSidebarModalOptions>(() => {
      if (typeof window !== "undefined") {
        const savedBaseLayer = localStorage.getItem("selectedBaseLayer");
        if (savedBaseLayer) {
          try {
            const parsed = JSON.parse(savedBaseLayer);
            console.log("Initialising with saved base layer:", parsed);
            return parsed;
          } catch (error) {
            console.error("Error parsing saved base layer:", error);
          }
        }
      }
      return defaultBaseLayer;
    });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const savedBaseLayer = localStorage.getItem("selectedBaseLayer");
      if (savedBaseLayer) {
        try {
          const parsed = JSON.parse(savedBaseLayer);
          const styleKey = parsed.id as MapStyleKey;
          if (Object.keys(MAP_STYLES).includes(styleKey)) {
            console.log("Initialising with saved style:", MAP_STYLES[styleKey]);
            return MAP_STYLES[styleKey];
          }
        } catch (error) {
          console.error("Error parsing saved base layer for style:", error);
        }
      }
    }
    return MAP_STYLES.light;
  });

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
    toggle3DMode,
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
    deleteSelectedAnnotations,
    osApiFeatures,
    clearOSApiLayer,
    addOSApiLayer,
    osApiLayerId,
  } = useAnnotations({
    mapRef,
    isMapReady,
    onDrawComplete: () => setSelectedEditItem(null),
    apiUrl,
  });

  // Layer Hook
  const {
    layerConfigs,
    selectedLayerId,
    isStyleModalOpen,
    setSelectedLayerId,
    setIsStyleModalOpen,
    updateLayerStyle,
    addMapLayer,
    removeMapLayer,
    handleStyleClick,
    getLayerSourceUrl,
    getLayerGeomTypeUrl,
    getLayerId,
    forceShowAllSelectedLayers,
  } = useLayer({
    mapRef,
    isMapReady,
    workspaceId,
    selectedLayers,
    workspaceConnections,
  });

  // Initial Load Complete
  // This is used to ensure that the map is loaded before the layers are added
  const initialLoadComplete = useRef(false);

  // State for 3D mode - this is used to toggle the 3D mode on the map
  const [is3DEnabled, setIs3DEnabled] = useState(false);

  // State for hydration - this is used to ensure that the map is loaded before the layers are added
  // safe to read local storage after this point
  const [isHydrated, setIsHydrated] = useState(false);

  const handleMainSidebarModalOpen = useCallback(
    (item: MainSidebarModalOptions) => {
      setSelectedItem(item);
      setIsModalOpen(true);
    },
    []
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setUploadSuccess(false);
    setUploadError(null);
    setSelectedFile(null);
    setFileName("");
  }, []);

  const handleFileSelection = useCallback((file: File) => {
    setSelectedFile(file);
    setUploadError(null);
  }, []);

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

  const handleAbortUpload = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError("Upload cancelled");
    setSelectedFile(null);
    setFileName("");
  }, []);

  const handleCancelSelection = useCallback(() => {
    setSelectedFile(null);
    setFileName("");
    setUploadError(null);
  }, []);

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

      console.log(
        `${
          willBeEnabled ? "Enabling" : "Disabling"
        } layer: ${layerName} (${layerId})`
      );

      const updatedLayers = {
        ...selectedLayers,
        [index]: willBeEnabled,
      };

      setSelectedLayers(updatedLayers);
      localStorage.setItem("selectedLayers", JSON.stringify(updatedLayers));

      // Handle visibility based on selection
      if (willBeEnabled) {
        try {
          const sourceUrl = getLayerSourceUrl(layerName);
          const geomTypeUrl = getLayerGeomTypeUrl(layerName);
          await addMapLayer(map, layerId, sourceUrl, layerName, geomTypeUrl);
        } catch (err) {
          console.error(`Error adding layer ${layerId}:`, err);
          // Revert on error
          setSelectedLayers((prev) => ({
            ...prev,
            [index]: false,
          }));
          localStorage.setItem(
            "selectedLayers",
            JSON.stringify({
              ...selectedLayers,
              [index]: false,
            })
          );
        }
      } else {
        removeMapLayer(map, layerId);
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

      setSelectedBaseItem(item);
      const styleKey = item.id as MapStyleKey;

      if (Object.keys(MAP_STYLES).includes(styleKey)) {
        const map = mapRef.current;

        fetch(MAP_STYLES[styleKey])
          .then((response) => response.json())
          .then((styleJson) => {
            map.setStyle(styleJson, { diff: true });
            setCurrentStyle(MAP_STYLES[styleKey]);

            const handleStyleLoad = () => {
              forceShowAllSelectedLayers(map);

              annotations.forEach((annotation) => {
                addAnnotationLayer(map, annotation);
              });

              if (osApiFeatures.length > 0 && osApiLayerId) {
                const layerId = "os-api-streets";
                addOSApiLayer(map, osApiFeatures, layerId);
              }

              if (is3DEnabled) {
                console.log("Re-applying 3D mode after base layer change");

                // Give the layers a moment to settle, then apply 3D!!
                requestAnimationFrame(() => {
                  if (map.isStyleLoaded()) {
                    toggle3DMode(true);
                  } else {
                    console.warn("Style not loaded when expected!");
                    map.once("idle", () => {
                      toggle3DMode(true);
                    });
                  }
                });
              }
            };

            // Use 'idle' event instead of 'styledata'
            // 'idle' fires when the map has finished loading and is idle
            map.once("idle", handleStyleLoad);
          })
          .catch((error) => {
            console.error("Error loading style:", error);
          });
      }
    },
    [
      mapRef,
      forceShowAllSelectedLayers,
      annotations,
      addAnnotationLayer,
      is3DEnabled,
      toggle3DMode,
      osApiFeatures,
      addOSApiLayer,
      osApiLayerId,
    ]
  );

  // Effect to fetch workspace layers
  useEffect(() => {
    const fetchWorkspaceSources = async () => {
      try {
        console.log("Fetching layers for workspace:", workspaceId);
        const connections = await getWorkspaceConnections(workspaceId);
        console.log("Received layers:", connections);
        setWorkspaceConnections(connections);
      } catch (error) {
        console.error("Failed to fetch workspace layers:", {
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

  // Effect to save map view state (zoom and center) when it changes
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    const map = mapRef.current;

    const saveMapView = () => {
      const zoom = map.getZoom();
      const center = map.getCenter();

      localStorage.setItem("mapZoom", JSON.stringify(zoom));
      localStorage.setItem(
        "mapCenter",
        JSON.stringify([center.lng, center.lat])
      );
    };

    // Save view state when zoom or pan ends
    map.on("zoomend", saveMapView);
    map.on("moveend", saveMapView);

    return () => {
      map.off("zoomend", saveMapView);
      map.off("moveend", saveMapView);
    };
  }, [mapRef, isMapReady]);

  // Effect to restore map view state from localStorage
  useEffect(() => {
    if (isMapReady && mapRef.current) {
      const map = mapRef.current;

      try {
        const savedZoom = localStorage.getItem("mapZoom");
        const savedCenter = localStorage.getItem("mapCenter");

        if (savedZoom && savedCenter) {
          const zoom = JSON.parse(savedZoom);
          const center = JSON.parse(savedCenter);

          console.log("Restoring map view - Zoom:", zoom, "Center:", center);

          // Restore the map view
          map.setCenter(center);
          map.setZoom(zoom);
        }
      } catch (error) {
        console.error("Error restoring map view:", error);
      }
    }
  }, [isMapReady, mapRef]);

  // Effect to save selected base layer when it changes
  useEffect(() => {
    localStorage.setItem("selectedBaseLayer", JSON.stringify(selectedBaseItem));
  }, [selectedBaseItem]);

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

      const saved3DMode = localStorage.getItem("is3DEnabled");
      if (saved3DMode) {
        try {
          const is3D = JSON.parse(saved3DMode);
          setIs3DEnabled(is3D);

          if (is3D && mapRef.current) {
            setTimeout(() => {
              if (mapRef.current) {
                console.log("Restoring 3D mode from localStorage");
                toggle3DMode(true);
              }
            }, 500);
          }
        } catch (error) {
          console.error("Error restoring 3D mode:", error);
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
    toggle3DMode,
  ]);

  // Effect to clean up layers when the map is unmounted
  useEffect(() => {
    const currentMap = mapRef?.current;

    return () => {
      if (!currentMap) return;

      const activeLayers = Object.entries(selectedLayers)
        .filter(([, isSelected]) => isSelected)
        .map(([index]) => {
          const connection = workspaceConnections[Number(index)];
          return connection ? getLayerId(String(connection)) : null;
        })
        .filter(Boolean) as string[];

      activeLayers.forEach((layerId: string) => {
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
  }, [mapRef, selectedLayers, workspaceConnections, getLayerId]);

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

  // Effect to apply layer ordering when selectedLayers changes
  useEffect(() => {
    if (
      mapRef?.current &&
      Object.values(selectedLayers).some((selected) => selected)
    ) {
      console.log("Selected layers changed, reapplying layer order");
      // Wait for any pending layer operations to complete
      setTimeout(() => {
        const map = mapRef.current;
        if (map) {
          // Re-add all layers to ensure proper ordering
          Object.entries(selectedLayers).forEach(
            async ([index, isSelected]) => {
              if (isSelected && workspaceConnections[Number(index)]) {
                try {
                  const connection = workspaceConnections[Number(index)];
                  const layerName = String(connection);
                  const layerId = getLayerId(layerName);

                  // Make sure the layer is visible
                  if (map.getLayer(layerId)) {
                    map.setLayoutProperty(layerId, "visibility", "visible");
                  }
                } catch (error) {
                  console.error("Error ensuring layer visibility:", error);
                }
              }
            }
          );
        }
      }, 100);
    }
  }, [selectedLayers, mapRef, workspaceConnections, getLayerId]);

  // TODO: Remove this effect in the future - it is for debugging purposes only for now!
  useEffect(() => {
    if (mapRef?.current && Object.keys(selectedLayers).length > 0) {
      const map = mapRef.current;
      const activeLayers = Object.entries(selectedLayers)
        .filter(([, isSelected]) => isSelected)
        .map(([index]) => {
          const connection = workspaceConnections[Number(index)];
          return connection ? getLayerId(String(connection)) : null;
        })
        .filter(Boolean) as string[];

      console.log("Selected layers state:", selectedLayers);
      console.log("Active layer IDs:", activeLayers);

      const layersOnMap = activeLayers.filter((id) => map.getLayer(id));
      console.log("Layers actually on map:", layersOnMap);

      layersOnMap.forEach((id) => {
        const visibility = map.getLayoutProperty(id, "visibility");
        console.log(`Layer ${id} visibility: ${visibility}`);
      });
    }
  }, [selectedLayers, mapRef, workspaceConnections, getLayerId]);

  // Effect to ensure all selected layers are visible when they change
  useEffect(() => {
    if (!mapRef?.current || !isMapReady) return;

    const timer = setTimeout(() => {
      if (mapRef.current) {
        forceShowAllSelectedLayers(mapRef.current);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedLayers, isMapReady, mapRef, forceShowAllSelectedLayers]);

  // Handle 3D mode toggle
  const handle3DToggle = useCallback(() => {
    const newState = !is3DEnabled;
    setIs3DEnabled(newState);
    toggle3DMode(newState);

    // Save 3D mode state to localStorage
    localStorage.setItem("is3DEnabled", JSON.stringify(newState));
  }, [is3DEnabled, toggle3DMode]);

  // Effect to mark component as hydrated and restore localStorage state
  // this means it is safe to read local storage after this point!!
  // TODO: Remove this effect in the future - it is very choppy at the moment
  useEffect(() => {
    setIsHydrated(true);

    // Restore base layer state
    const savedBaseLayer = localStorage.getItem("selectedBaseLayer");
    if (savedBaseLayer) {
      try {
        const parsed = JSON.parse(savedBaseLayer);
        console.log("Restoring base layer after hydration:", parsed);
        setSelectedBaseItem(parsed);

        const styleKey = parsed.id as MapStyleKey;
        if (Object.keys(MAP_STYLES).includes(styleKey)) {
          setCurrentStyle(MAP_STYLES[styleKey]);
        }
      } catch (error) {
        console.error("Error restoring base layer:", error);
      }
    }
  }, []);

  // Add the feature selection hook with osApiFeatures:
  const {
    selectedFeature,
    isFeatureModalOpen,
    clearSelection,
    closeFeatureModal,
  } = useFeatureSelection({
    mapRef,
    isMapReady,
    osApiFeatures,
    onFeatureClick: (feature) => {
      if (feature) {
        console.log("Feature clicked:", feature.properties);
      }
    },
  });

  const handleLayerDeactivate = useCallback(() => {
    if (!selectedFeature) return;

    const layerId = selectedFeature.layerId;

    // Remove glow effect first if it exists
    // TODO: this is a temporary - think I want to get rid of the glow effect entirely...
    if (mapRef.current) {
      const map = mapRef.current;
      const glowLayerId = `${layerId}-glow`;
      if (map.getLayer(glowLayerId)) {
        map.removeLayer(glowLayerId);
      }
    }

    const layerIndex = workspaceConnections.findIndex((connection) => {
      const connectionLayerId = getLayerId(String(connection));
      return connectionLayerId === layerId;
    });

    if (layerIndex !== -1) {
      handleSelectLayer(layerIndex, workspaceConnections[layerIndex]);
      closeFeatureModal();
      clearSelection();
    }
  }, [
    selectedFeature,
    workspaceConnections,
    getLayerId,
    handleSelectLayer,
    closeFeatureModal,
    clearSelection,
    mapRef,
  ]);

  // Handle keyboard remove of the selected feature
  useEffect(() => {
    if (!mapRef?.current || !isMapReady) return;

    const mapContainer = mapRef.current.getContainer();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();

        // If an OS API feature is selected, clear the OS layer!!
        if (selectedFeature && selectedFeature.layerId.startsWith("os-api-")) {
          clearOSApiLayer();
          closeFeatureModal();
          clearSelection();
          return;
        }

        // If a regular layer feature is selected, just deactivate the layer - don't delete it!
        if (selectedFeature && selectedFeature.layerId.startsWith("layer-")) {
          handleLayerDeactivate();
          return;
        }
        deleteSelectedAnnotations();
      }
    };

    mapContainer.addEventListener("keydown", handleKeyDown);
    mapContainer.setAttribute("tabindex", "0");

    return () => {
      mapContainer.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    mapRef,
    isMapReady,
    selectedFeature,
    clearOSApiLayer,
    closeFeatureModal,
    clearSelection,
    handleLayerDeactivate,
    deleteSelectedAnnotations,
  ]);

  return (
    <div className="relative w-full h-screen">
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
        is3DEnabled={is3DEnabled}
        on3DToggle={handle3DToggle}
      />

      <BaseLayerSidebar
        onBaseItemClick={handleBaseLayerSidebarClick}
        selectedBaseItem={selectedBaseItem}
        isHydrated={isHydrated}
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
        onAnnotationDelete={
          selectedAnnotation ? deleteSelectedAnnotations : undefined
        }
      />
      <FeatureModal
        isOpen={isFeatureModalOpen}
        selectedFeature={selectedFeature}
        onClose={closeFeatureModal}
        onClearSelection={clearSelection}
        onClearOSApiLayer={clearOSApiLayer}
      />
    </div>
  );
}
