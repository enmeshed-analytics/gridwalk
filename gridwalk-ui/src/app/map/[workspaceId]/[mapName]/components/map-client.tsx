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
import { useFeatureSelection } from "./hooks/useFeatureSelection";

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
  } = useAnnotations({
    mapRef,
    isMapReady,
    onDrawComplete: () => setSelectedEditItem(null),
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

      console.log(
        `${
          willBeEnabled ? "Enabling" : "Disabling"
        } layer: ${layerName} (${layerId})`
      );

      // Update state with new selection
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
        // Use removeMapLayer instead of directly setting layout property
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
            // Apply the new style
            map.setStyle(styleJson, { diff: true });
            setCurrentStyle(MAP_STYLES[styleKey]);

            // Wait for style to be completely loaded
            const handleStyleLoad = () => {
              // First restore all layers
              forceShowAllSelectedLayers(map);

              // Add annotations
              annotations.forEach((annotation) => {
                addAnnotationLayer(map, annotation);
              });

              // Now handle 3D mode if it is enabled
              if (is3DEnabled) {
                console.log("Re-applying 3D mode after base layer change");

                // Give the layers a moment to settle, then apply 3D!!
                requestAnimationFrame(() => {
                  if (map.isStyleLoaded()) {
                    toggle3DMode(true);
                  } else {
                    // This shouldn't happen, but just in case...
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
      // Restore saved layers
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

      // Restore saved 3D mode state
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

      // Derive active layer IDs from selectedLayers
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

      // Log current state of layers
      console.log("Selected layers state:", selectedLayers);
      console.log("Active layer IDs:", activeLayers);

      // Check which layers are actually on the map
      const layersOnMap = activeLayers.filter((id) => map.getLayer(id));
      console.log("Layers actually on map:", layersOnMap);

      // Log visibility status
      layersOnMap.forEach((id) => {
        const visibility = map.getLayoutProperty(id, "visibility");
        console.log(`Layer ${id} visibility: ${visibility}`);
      });
    }
  }, [selectedLayers, mapRef, workspaceConnections, getLayerId]);

  // Effect to ensure all selected layers are visible when they change
  useEffect(() => {
    if (!mapRef?.current || !isMapReady) return;

    // Use a delay to ensure the map has stabilized
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

  // Add the feature selection hook
  const {
    selectedFeature,
    isFeatureModalOpen,
    clearSelection,
    closeFeatureModal,
  } = useFeatureSelection({
    mapRef,
    isMapReady,
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
    if (mapRef.current) {
      const map = mapRef.current;
      const glowLayerId = `${layerId}-glow`;
      if (map.getLayer(glowLayerId)) {
        map.removeLayer(glowLayerId);
      }
    }

    // Find which layer index this corresponds to
    const layerIndex = workspaceConnections.findIndex((connection) => {
      const connectionLayerId = getLayerId(String(connection));
      return connectionLayerId === layerId;
    });

    if (layerIndex !== -1) {
      // Deactivate the layer using existing toggle function
      handleSelectLayer(layerIndex, workspaceConnections[layerIndex]);

      // Close the modal
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
        handleLayerDeactivate();
      }
    };

    mapContainer.addEventListener("keydown", handleKeyDown);
    mapContainer.setAttribute("tabindex", "0");

    return () => {
      mapContainer.removeEventListener("keydown", handleKeyDown);
    };
  }, [mapRef, isMapReady, handleLayerDeactivate]);

  // TODO: this effect should actually pull in attribute details for the selected feature
  // It should be improved to use the selectedFeature hook and not rely on the selectedFeature state???
  useEffect(() => {
    if (selectedFeature) {
      console.log("Currently selected:", selectedFeature.properties);
    }
  }, [selectedFeature]);

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

      {/* Feature Modal - TODO: this needs moving to a separate component */}
      {/* TODO: the css is wrong and the modal is not being displayed correctly */}
      {isFeatureModalOpen && selectedFeature && (
        <div className="absolute bottom-32 right-4 bg-gray-100 dark:bg-gray-800 p-4 rounded z-50 w-80">
          <div className="flex justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Feature Details
            </h2>
            <button
              onClick={() => {
                closeFeatureModal();
                clearSelection();
              }}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl"
            >
              ×
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-gray-900 dark:text-gray-100">
              <strong>Layer:</strong>{" "}
              <span className="text-gray-600 dark:text-gray-300">
                {selectedFeature.layerId}
              </span>
            </p>
            <p className="text-gray-900 dark:text-gray-100">
              <strong>Feature ID:</strong>{" "}
              <span className="text-gray-600 dark:text-gray-300">
                {selectedFeature.id || "N/A"}
              </span>
            </p>

            {Object.keys(selectedFeature.properties).length > 0 && (
              <div>
                <strong className="text-gray-900 dark:text-gray-100">
                  Properties:
                </strong>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {Object.entries(selectedFeature.properties).map(
                    ([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {key}:
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 truncate ml-2">
                          {String(value)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="flex justify-between gap-2">
              {selectedFeature.layerId.startsWith("layer-") && (
                <button
                  onClick={handleLayerDeactivate}
                  className="px-4 py-2 text-sm bg-red-500 dark:bg-red-600 text-white rounded-md hover:bg-red-600 dark:hover:bg-red-500 transition-colors flex items-center gap-2 font-medium shadow-md"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L12 12m-3.122-3.122l4.242 4.242M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Remove Layer
                </button>
              )}

              <button
                onClick={() => {
                  closeFeatureModal();
                  clearSelection();
                }}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
