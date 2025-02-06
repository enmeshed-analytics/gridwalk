"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import MainSidebar from "./sideBars/mainSidebar";
import MapEditSidebar from "./sideBars/mapEditSidebar";
import BaseLayerSidebar from "./sideBars/baseLayerSidebar";
import {
  MainSidebarModalOptions,
  MapEditSidebarModalOptions,
  BaseLayerSidebarModalOptions,
} from "./sideBars/types";
import { useMapInit } from "./mapInit";
import {
  useSingleFileUploader,
  useShapefileUploader,
} from "./hooks/fileUpload";
import {
  getWorkspaceConnections,
  WorkspaceConnection,
} from "./actions/getSources";
import {
  MAP_STYLES,
  MapStyleKey,
  INITIAL_MAP_CONFIG,
  MapClientProps,
  FileHandlerResponse,
} from "./types";

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
  const activeLayerIds = useRef<string[]>([]);
  const [selectedLayers, setSelectedLayers] = useState<{
    [key: number]: boolean;
  }>({});
  const initialLoadComplete = useRef(false);

  // Map Initialisation Config
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

  // TODO move file uploader to a seperate component
  const { uploadSingleFile } = useSingleFileUploader();
  const { uploadShapefile } = useShapefileUploader();
  const handleFileUpload = useCallback(
    async (fileToUpload: File) => {
      if (!fileToUpload || !fileName.trim()) {
        setUploadError("Please provide a valid file and name");
        return;
      }

      const extension = fileToUpload.name.split(".").pop()?.toLowerCase();
      if (!extension) {
        setUploadError("File must have an extension");
        return;
      }

      // Explicitly check if the file type is supported before proceeding
      const supportedTypes = [
        "gpkg",
        "zip",
        "xlsx",
        "csv",
        "parquet",
        "json",
        "geojson",
      ];

      if (!supportedTypes.includes(extension)) {
        setUploadError(
          `Unsupported file type: ${extension}. Supported types are: ${supportedTypes.join(
            ", "
          )}`
        );
        return;
      }

      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(false);
      setUploadProgress(0);

      const fileTypeHandlers: Record<
        string,
        (file: File) => Promise<FileHandlerResponse>
      > = {
        gpkg: async (file: File): Promise<FileHandlerResponse> => {
          return new Promise((resolve, reject) => {
            uploadSingleFile(
              file,
              "",
              (progress) => setUploadProgress(progress),
              (response) => {
                setUploadSuccess(true);
                setTimeout(() => {
                  setUploadSuccess(false);
                  handleModalClose();
                }, 1500);
                resolve(response);
              },
              reject
            );
          });
        },
        zip: async (file: File): Promise<FileHandlerResponse> => {
          return new Promise((resolve, reject) => {
            uploadShapefile(
              file,
              "",
              (progress) => setUploadProgress(progress),
              (response) => {
                setUploadSuccess(true);
                setTimeout(() => {
                  setUploadSuccess(false);
                  handleModalClose();
                }, 1500);
                resolve(response);
              },
              (error) => {
                setUploadError(error);
                reject(error);
              }
            );
          });
        },
        xlsx: async (file: File): Promise<FileHandlerResponse> => {
          return new Promise((resolve, reject) => {
            uploadSingleFile(
              file,
              "",
              (progress) => setUploadProgress(progress),
              (response) => {
                setUploadSuccess(true);
                setTimeout(() => {
                  setUploadSuccess(false);
                  handleModalClose();
                }, 1500);
                resolve(response);
              },
              reject
            );
          });
        },
        csv: async (file: File): Promise<FileHandlerResponse> => {
          return new Promise((resolve, reject) => {
            uploadSingleFile(
              file,
              "",
              (progress) => setUploadProgress(progress),
              (response) => {
                setUploadSuccess(true);
                setTimeout(() => {
                  setUploadSuccess(false);
                  handleModalClose();
                }, 1500);
                resolve(response);
              },
              reject
            );
          });
        },
        parquet: async (file: File): Promise<FileHandlerResponse> => {
          return new Promise((resolve, reject) => {
            uploadSingleFile(
              file,
              "",
              (progress) => setUploadProgress(progress),
              (response) => {
                setUploadSuccess(true);
                setTimeout(() => {
                  setUploadSuccess(false);
                  handleModalClose();
                }, 1500);
                resolve(response);
              },
              reject
            );
          });
        },
        json: async (file: File): Promise<FileHandlerResponse> => {
          return new Promise((resolve, reject) => {
            uploadSingleFile(
              file,
              "",
              (progress) => setUploadProgress(progress),
              (response) => {
                setUploadSuccess(true);
                setTimeout(() => {
                  setUploadSuccess(false);
                  handleModalClose();
                }, 1500);
                resolve(response);
              },
              reject
            );
          });
        },
        geojson: async (file: File): Promise<FileHandlerResponse> => {
          return new Promise((resolve, reject) => {
            uploadSingleFile(
              file,
              "",
              (progress) => setUploadProgress(progress),
              (response) => {
                setUploadSuccess(true);
                setTimeout(() => {
                  setUploadSuccess(false);
                  handleModalClose();
                }, 1500);
                resolve(response);
              },
              reject
            );
          });
        },
      };

      try {
        const renamedFile = new File(
          [fileToUpload],
          `${fileName}${extension ? `.${extension}` : ""}`,
          { type: fileToUpload.type }
        );

        const handler = fileTypeHandlers[extension];
        if (!handler) {
          throw new Error(`Unsupported file type: ${extension}`);
        }
        await handler(renamedFile);

        try {
          const connections = await getWorkspaceConnections(workspaceId);
          setWorkspaceConnections(connections);
        } catch (error) {
          console.error("Failed to refresh workspace connections:", error);
        }

        // Add delay for error messages
        if (!uploadSuccess) {
          setTimeout(() => {
            handleModalClose();
          }, 1500);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          setUploadError(error.message);
          console.log(`Upload Error: ${error.message}`);
          setTimeout(() => {
            handleModalClose();
          }, 1500);
        } else {
          setUploadError("An unknown error occurred");
          console.log("Unknown upload error:", error);
          setTimeout(() => {
            handleModalClose();
          }, 1500);
        }
      } finally {
        setIsUploading(false);
      }
    },
    [
      fileName,
      uploadSingleFile,
      uploadShapefile,
      handleModalClose,
      setUploadSuccess,
      setUploadError,
      uploadSuccess,
      workspaceId,
    ]
  );

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

  const addMapLayer = useCallback(
    async (
      map: maplibregl.Map,
      layerId: string,
      sourceUrl: string,
      sourceLayerName: string,
      geomTypeUrl: string
    ) => {
      try {
        // Fetch the geometry type from the API
        const response = await fetch(geomTypeUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch geometry type: ${response.statusText}`
          );
        }
        const geomType = await response.text();

        // Add the source if it doesn't exist
        if (!map.getSource(layerId)) {
          map.addSource(layerId, {
            type: "vector",
            tiles: [sourceUrl],
            minzoom: 0,
            maxzoom: 22,
          });
        }

        // Configure the layer based on geometry type
        // TODO ADD PROPER TYPE FOR LAYER CONFIG
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let layerConfig: any;
        switch (geomType.toLowerCase().trim()) {
          case "linestring":
          case "multilinestring":
            layerConfig = {
              type: "line",
              paint: {
                "line-color": "#0080ff",
                "line-opacity": 0.8,
                "line-width": 2,
              },
            };
            break;
          case "polygon":
          case "multipolygon":
            layerConfig = {
              type: "fill",
              paint: {
                "fill-color": "#0080ff",
                "fill-opacity": 0.5,
                "fill-outline-color": "#0066cc",
              },
            };
            break;
          case "point":
          case "multipoint":
            layerConfig = {
              type: "circle",
              paint: {
                "circle-color": "#0080ff",
                "circle-opacity": 0.5,
                "circle-radius": 6,
              },
            };
            break;
          default:
            console.warn(
              `Unknown geometry type: ${geomType}, defaulting to point`
            );
            layerConfig = {
              type: "circle",
              paint: {
                "circle-color": "#0080ff",
                "circle-opacity": 0.5,
                "circle-radius": 6,
              },
            };
        }

        // Add the layer to the map
        map.addLayer({
          id: layerId,
          source: layerId,
          "source-layer": sourceLayerName,
          ...layerConfig,
        });

        return geomType;
      } catch (error) {
        console.error("Error adding map layer:", error);
        throw error;
      }
    },
    []
  );

  const handleBaseLayerSidebarClick = useCallback(
    (item: BaseLayerSidebarModalOptions) => {
      if (!mapRef.current) return;
      console.log("Active layers before style change:", activeLayerIds.current);

      // Get current active layers
      const currentLayerConfigs = activeLayerIds.current.map((layerId) => {
        const layerName = layerId.replace(`layer-${workspaceId}-`, "");
        return {
          layerId,
          layerName,
          sourceUrl: `${process.env.NEXT_PUBLIC_GRIDWALK_API}/workspaces/${workspaceId}/connections/primary/sources/${layerName}/tiles/{z}/{x}/{y}`,
          geomTypeUrl: `${process.env.NEXT_PUBLIC_GRIDWALK_API}/workspaces/${workspaceId}/connections/primary/sources/${layerName}/tiles/geometry`,
        };
      });

      setSelectedBaseItem(item);
      const styleKey = item.id as MapStyleKey;

      if (styleKey in MAP_STYLES) {
        const map = mapRef.current;
        let hasRestoredLayers = false;

        const setupStyleLoadHandlers = () => {
          console.log("Setting up style load handlers");

          const handleIdle = async () => {
            if (map.isStyleLoaded() && !hasRestoredLayers) {
              console.log("Style is loaded, restoring layers");
              await restoreLayers();
              hasRestoredLayers = true;

              map.off("idle", handleIdle);
            }
          };

          map.on("idle", handleIdle);

          setTimeout(() => {
            map.off("idle", handleIdle);
          }, 5000);
        };

        const restoreLayers = async () => {
          for (const {
            layerId,
            layerName,
            sourceUrl,
            geomTypeUrl,
          } of currentLayerConfigs) {
            try {
              console.log(`Adding layer: ${layerName}`);
              if (!map.getSource(layerId)) {
                await addMapLayer(
                  map,
                  layerId,
                  sourceUrl,
                  layerName,
                  geomTypeUrl
                );
                console.log(`Layer ${layerName} added successfully`);
              }
            } catch (error) {
              console.error(`Error adding layer ${layerName}:`, error);
            }
          }
        };

        setupStyleLoadHandlers();

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

  const handleSelectLayer = useCallback(
    async (index: number, connection: WorkspaceConnection) => {
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
          const url = new URL(window.location.href);
          const pathParts = url.pathname.split("/");
          const workspaceIdFromUrl = pathParts[2];

          const sourceUrl = `${process.env.NEXT_PUBLIC_GRIDWALK_API}/workspaces/${workspaceIdFromUrl}/connections/primary/sources/${layerName}/tiles/{z}/{x}/{y}`;
          const geomTypeUrl = `${process.env.NEXT_PUBLIC_GRIDWALK_API}/workspaces/${workspaceIdFromUrl}/connections/primary/sources/${layerName}/tiles/geometry`;

          await addMapLayer(
            map,
            layerId,
            sourceUrl,
            sourceLayerName,
            geomTypeUrl
          );
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
      />
      <BaseLayerSidebar
        onBaseItemClick={handleBaseLayerSidebarClick}
        selectedBaseItem={selectedBaseItem}
      />
    </div>
  );
}
