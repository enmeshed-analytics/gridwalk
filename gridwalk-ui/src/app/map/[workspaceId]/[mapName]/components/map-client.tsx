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
import { useFileUploader } from "./hooks/fileUpload/useFileUploader";
import {
  MAP_STYLES,
  MapStyleKey,
  INITIAL_MAP_CONFIG,
  MapClientProps,
  LayerConfig,
  LayerStyle,
} from "./types";
import { StyleModal } from "./layerStyling/layer-style-modal";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

const defaultBaseLayer: BaseLayerSidebarModalOptions = {
  id: "light",
  title: "Light Mode",
  icon: "light",
  description: "Light base map style",
};

// Update the type definition
type LayerConfigType =
  | {
      type: "line";
      paint: {
        "line-color": string;
        "line-opacity": number;
        "line-width": number;
      };
    }
  | {
      type: "fill";
      paint: {
        "fill-color": string;
        "fill-opacity": number;
        "fill-outline-color": string;
      };
    }
  | {
      type: "circle";
      paint: {
        "circle-color": string;
        "circle-opacity": number;
        "circle-radius": number;
      };
    };

interface Annotation extends GeoJSON.Feature {
  id: string;
  properties: {
    type?: "square" | "hexagon" | "circle" | "line" | "polygon" | "point";
    style?: {
      color: string;
      opacity: number;
      width?: number; // Added for line width
      radius?: number; // Added for point radius
    };
  };
}

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

  // Layer styling states for things such as color, opacity, width, radius etc, etc
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [layerConfigs, setLayerConfigs] = useState<{
    [key: string]: LayerConfig;
  }>({});

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

  // Add a ref for the draw control
  const drawRef = useRef<MapboxDraw | null>(null);

  // Add annotations state
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

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

  const addAnnotationLayer = useCallback(
    (map: maplibregl.Map, annotation: Annotation) => {
      try {
        // Check if layer already exists and remove it
        if (map.getLayer(annotation.id)) {
          map.removeLayer(annotation.id);
        }
        if (map.getSource(annotation.id)) {
          map.removeSource(annotation.id);
        }

        // Add the source
        map.addSource(annotation.id, {
          type: "geojson",
          data: annotation,
        });

        if (!annotation.geometry) {
          console.warn("Annotation missing geometry:", annotation);
          return;
        }

        // Check the geometry type to determine which layer type to add
        const geomType = annotation.geometry.type.toLowerCase();
        console.log(`Adding annotation of type ${geomType}:`, annotation);

        if (geomType.includes("linestring")) {
          // Add a line layer for LineString features
          map.addLayer({
            id: annotation.id,
            type: "line",
            source: annotation.id,
            paint: {
              "line-color": annotation.properties.style?.color || "#3880ff",
              "line-opacity": annotation.properties.style?.opacity || 0.8,
              "line-width": annotation.properties.style?.width || 3,
            },
          });
        } else if (geomType.includes("point")) {
          // Add a circle layer for Point features
          map.addLayer({
            id: annotation.id,
            type: "circle",
            source: annotation.id,
            paint: {
              "circle-color": annotation.properties.style?.color || "#3880ff",
              "circle-opacity": annotation.properties.style?.opacity || 0.8,
              "circle-radius": annotation.properties.style?.radius || 5,
            },
          });
        } else if (geomType.includes("polygon")) {
          // For polygon features
          map.addLayer({
            id: annotation.id,
            type: "fill",
            source: annotation.id,
            paint: {
              "fill-color": annotation.properties.style?.color || "#3880ff",
              "fill-opacity": annotation.properties.style?.opacity || 0.5,
              "fill-outline-color":
                annotation.properties.style?.color || "#3880ff",
            },
          });
        } else {
          console.warn(`Unknown geometry type: ${geomType}`);
        }
      } catch (err) {
        console.error("Error in addAnnotationLayer:", err, annotation);
      }
    },
    []
  );

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

  useEffect(() => {
    const savedConfigs = localStorage.getItem("layerConfigs");
    if (savedConfigs) {
      setLayerConfigs(JSON.parse(savedConfigs));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("layerConfigs", JSON.stringify(layerConfigs));
  }, [layerConfigs]);

  const updateLayerStyle = useCallback(
    (layerId: string, style: LayerStyle) => {
      if (!mapRef.current) return;
      const map = mapRef.current;
      const config = layerConfigs[layerId];

      if (!config) return;

      const updatedConfigs = {
        ...layerConfigs,
        [layerId]: {
          ...layerConfigs[layerId],
          style,
        },
      };

      // Update state
      setLayerConfigs(updatedConfigs);

      // Immediately update localStorage
      localStorage.setItem("layerConfigs", JSON.stringify(updatedConfigs));

      // Apply style based on geometry type
      switch (config.geomType.toLowerCase().trim()) {
        case "point":
        case "multipoint":
          map.setPaintProperty(layerId, "circle-color", style.color);
          map.setPaintProperty(layerId, "circle-opacity", style.opacity);
          if (style.radius)
            map.setPaintProperty(layerId, "circle-radius", style.radius);
          break;
        case "linestring":
        case "multilinestring":
          map.setPaintProperty(layerId, "line-color", style.color);
          map.setPaintProperty(layerId, "line-opacity", style.opacity);
          if (style.width)
            map.setPaintProperty(layerId, "line-width", style.width);
          break;
        case "polygon":
        case "multipolygon":
          map.setPaintProperty(layerId, "fill-color", style.color);
          map.setPaintProperty(layerId, "fill-opacity", style.opacity);
          map.setPaintProperty(layerId, "fill-outline-color", style.color);
          break;
      }
    },
    [mapRef, layerConfigs]
  );

  const addMapLayer = useCallback(
    async (
      map: maplibregl.Map,
      layerId: string,
      sourceUrl: string,
      sourceLayerName: string,
      geomTypeUrl: string
    ) => {
      try {
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

        // Get saved configuration or use default
        const savedConfig = layerConfigs[layerId];
        const defaultStyle = {
          color: "#0080ff",
          opacity: 0.5,
          radius: 6,
          width: 2,
        };

        const style = savedConfig?.style || defaultStyle;

        // Configure the layer based on geometry type with saved or default style
        let layerConfig: LayerConfigType;
        switch (geomType.toLowerCase().trim()) {
          case "linestring":
          case "multilinestring":
            layerConfig = {
              type: "line",
              paint: {
                "line-color": style.color,
                "line-opacity": style.opacity,
                "line-width": style.width || 2,
              },
            };
            break;
          case "polygon":
          case "multipolygon":
            layerConfig = {
              type: "fill",
              paint: {
                "fill-color": style.color,
                "fill-opacity": style.opacity,
                "fill-outline-color": style.color,
              },
            };
            break;
          case "point":
          case "multipoint":
            layerConfig = {
              type: "circle",
              paint: {
                "circle-color": style.color,
                "circle-opacity": style.opacity,
                "circle-radius": style.radius || 6,
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
                "circle-color": style.color,
                "circle-opacity": style.opacity,
                "circle-radius": style.radius || 6,
              },
            };
        }

        // Add the layer to the map
        map.addLayer({
          id: layerId,
          source: layerId,
          "source-layer": sourceLayerName,
          ...layerConfig,
        } as maplibregl.LayerSpecification);

        // Store the configuration if it doesn't exist
        if (!savedConfig) {
          setLayerConfigs((prev) => ({
            ...prev,
            [layerId]: {
              layerId,
              geomType,
              style,
            },
          }));
        }

        return geomType;
      } catch (error) {
        console.error("Error adding map layer:", error);
        throw error;
      }
    },
    [layerConfigs]
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

              // Restore annotations after layers
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
    [addMapLayer, workspaceId, mapRef, annotations, addAnnotationLayer]
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

  const handleStyleClick = (layerId: string) => {
    console.log("Style click triggered for layer:", layerId);
    console.log("Current layer configs:", layerConfigs);
    setSelectedLayerId(layerId);
    setIsStyleModalOpen(true);
  };

  // Add effect to save annotations whenever they change
  useEffect(() => {
    if (annotations.length > 0) {
      localStorage.setItem("mapAnnotations", JSON.stringify(annotations));
    }
  }, [annotations]);

  // Draw control when the map is ready
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    const map = mapRef.current;

    // Initialize draw with comprehensive styles for all geometry types
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: false,
        point: false,
        line_string: false,
        trash: false,
      },
      styles: [
        {
          id: "gl-draw-line-active",
          type: "line",
          filter: [
            "all",
            ["==", "$type", "LineString"],
            ["==", "active", "true"],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#3880ff",
            "line-dasharray": [0.2, 2],
            "line-width": 3,
          },
        },
        {
          id: "gl-draw-polygon-fill-active",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["==", "active", "true"]],
          paint: {
            "fill-color": "#3880ff",
            "fill-opacity": 0.1,
          },
        },
        {
          id: "gl-draw-polygon-stroke-active",
          type: "line",
          filter: ["all", ["==", "$type", "Polygon"], ["==", "active", "true"]],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#3880ff",
            "line-width": 3,
          },
        },
        {
          id: "gl-draw-polygon-and-line-vertex-active",
          type: "circle",
          filter: [
            "all",
            ["==", "meta", "vertex"],
            ["==", "$type", "Point"],
            ["!=", "mode", "static"],
          ],
          paint: {
            "circle-radius": 5,
            "circle-color": "#fff",
            "circle-stroke-color": "#3880ff",
            "circle-stroke-width": 2,
          },
        },
        {
          id: "gl-draw-polygon-and-line-midpoint-active",
          type: "circle",
          filter: [
            "all",
            ["==", "meta", "midpoint"],
            ["==", "$type", "Point"],
            ["!=", "mode", "static"],
          ],
          paint: {
            "circle-radius": 3,
            "circle-color": "#3880ff",
          },
        },
        {
          id: "gl-draw-line",
          type: "line",
          filter: [
            "all",
            ["==", "$type", "LineString"],
            ["!=", "mode", "static"],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#3880ff",
            "line-width": 3,
            "line-opacity": 0.8,
          },
        },
        {
          id: "gl-draw-polygon-fill",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          paint: {
            "fill-color": "#3880ff",
            "fill-outline-color": "#3880ff",
            "fill-opacity": 0.5,
          },
        },
        {
          id: "gl-draw-polygon-stroke",
          type: "line",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#3880ff",
            "line-width": 2,
          },
        },
        {
          id: "gl-draw-point",
          type: "circle",
          filter: [
            "all",
            ["==", "$type", "Point"],
            ["==", "meta", "feature"],
            ["!=", "mode", "static"],
          ],
          paint: {
            "circle-radius": 5,
            "circle-color": "#3880ff",
            "circle-opacity": 0.8,
          },
        },
      ],
    });

    map.addControl(draw);
    drawRef.current = draw;

    // Load saved annotations
    try {
      const savedAnnotations = localStorage.getItem("mapAnnotations");
      if (savedAnnotations) {
        const parsed = JSON.parse(savedAnnotations);
        // Add features to the draw control
        parsed.forEach((feature: GeoJSON.Feature) => {
          try {
            draw.add(feature);
          } catch (err) {
            console.error("Error adding feature:", err, feature);
          }
        });
        setAnnotations(parsed);
      }
    } catch (error) {
      console.error("Error loading annotations:", error);
    }

    function updateAnnotations() {
      if (!drawRef.current) return;

      try {
        const data = drawRef.current.getAll();
        console.log("Draw features:", data.features);

        if (!data.features.length) {
          setAnnotations([]);
          localStorage.setItem("mapAnnotations", JSON.stringify([]));
          return;
        }

        // Map the features to Annotation objects
        const annotations = data.features.map((feature) => {
          // Ensure each feature has a string ID
          const id = String(
            feature.id ||
              `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          );

          let featureType;
          let defaultStyle: Annotation["properties"]["style"] = {
            color: "#3880ff",
            opacity: 0.5,
          };

          if (!feature.geometry) {
            console.warn("Feature missing geometry:", feature);
            featureType = "unknown";
          } else {
            switch (feature.geometry.type) {
              case "LineString":
              case "MultiLineString":
                featureType = "line";
                defaultStyle = {
                  color: "#3880ff",
                  opacity: 0.8,
                  width: 3,
                } as Annotation["properties"]["style"];
                break;
              case "Point":
              case "MultiPoint":
                featureType = "point";
                defaultStyle = {
                  color: "#3880ff",
                  opacity: 0.8,
                  radius: 5,
                } as Annotation["properties"]["style"];
                break;
              case "Polygon":
              case "MultiPolygon":
                featureType = "polygon";
                defaultStyle = {
                  color: "#3880ff",
                  opacity: 0.5,
                } as Annotation["properties"]["style"];
                break;
              default:
                featureType = "unknown";
                console.warn("Unknown geometry type:", feature.geometry.type);
            }
          }

          // Create an Annotation from the feature
          const annotation: Annotation = {
            ...feature,
            id,
            properties: {
              ...feature.properties,
              type: feature.properties?.type || featureType,
              style: feature.properties?.style || defaultStyle,
            },
          };

          return annotation;
        });

        console.log("Processed annotations:", annotations);
        setAnnotations(annotations);
        localStorage.setItem("mapAnnotations", JSON.stringify(annotations));
      } catch (err) {
        console.error("Error in updateAnnotations:", err);
      }
    }

    map.on("draw.create", updateAnnotations);
    map.on("draw.update", updateAnnotations);
    map.on("draw.delete", updateAnnotations);
    map.on("draw.selectionchange", updateAnnotations);

    return () => {
      map.off("draw.create", updateAnnotations);
      map.off("draw.update", updateAnnotations);
      map.off("draw.delete", updateAnnotations);
      map.off("draw.selectionchange", updateAnnotations);

      // Add defensive cleanup for the draw control
      try {
        if (map && drawRef.current && map.getStyle()) {
          // Only remove if map is still valid and has a style
          map.removeControl(drawRef.current);
          drawRef.current = null;
        }
      } catch (err) {
        console.warn("Error removing draw control during cleanup:", err);
        // Don't rethrow - we're in cleanup and want to suppress errors
      }
    };
  }, [mapRef, isMapReady]);

  // Ensure the draw mode is correctly changed when a tool is selected
  useEffect(() => {
    if (!drawRef.current || !selectedEditItem || !mapRef.current) return;

    const draw = drawRef.current;
    console.log("Changing to drawing mode:", selectedEditItem.id);

    try {
      switch (selectedEditItem.id) {
        case "point":
          draw.changeMode("draw_point");
          break;
        case "line":
          draw.changeMode("draw_line_string");
          break;
        case "square":
        case "hexagon":
        case "circle":
          draw.changeMode("draw_polygon");
          break;
        case "delete":
          const selectedIds = draw.getSelectedIds();
          if (selectedIds.length > 0) {
            draw.trash();
          } else {
            draw.changeMode("simple_select");
          }
          break;
        case "select":
        default:
          draw.changeMode("simple_select");
          break;
      }
    } catch (err) {
      console.error("Error changing draw mode:", err);
      // Try to recover by setting to simple_select
      try {
        draw.changeMode("simple_select");
      } catch (e) {
        console.error("Could not recover to simple_select mode:", e);
      }
    }
  }, [selectedEditItem, mapRef]);

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
        isOpen={isStyleModalOpen}
        onClose={() => setIsStyleModalOpen(false)}
        layerConfig={selectedLayerId ? layerConfigs[selectedLayerId] : null}
        onStyleUpdate={(style) => {
          if (selectedLayerId) {
            updateLayerStyle(selectedLayerId, style);
          }
        }}
      />
    </div>
  );
}
