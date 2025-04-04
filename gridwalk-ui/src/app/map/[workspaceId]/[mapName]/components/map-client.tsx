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
  LayerConfig,
  LayerStyle,
} from "./types";
import { StyleModal } from "./sidebars/layer-style-modal";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

const defaultBaseLayer: BaseLayerSidebarModalOptions = {
  id: "light",
  title: "Light Mode",
  icon: "light",
  description: "Light base map style",
};

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
      width?: number;
      radius?: number;
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

  // Add this state near your other states
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<Annotation | null>(null);

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
        console.log(`START addAnnotationLayer for ID: ${annotation.id}`);

        if (map.getLayer(annotation.id)) {
          console.log(`Removing existing layer for ID: ${annotation.id}`);
          map.removeLayer(annotation.id);
        }
        if (map.getSource(annotation.id)) {
          console.log(`Removing existing source for ID: ${annotation.id}`);
          map.removeSource(annotation.id);
        }

        console.log(`Adding source for ID: ${annotation.id}`, annotation);
        map.addSource(annotation.id, {
          type: "geojson",
          data: annotation,
        });

        if (!annotation.geometry) {
          console.warn("Annotation missing geometry:", annotation);
          return;
        }

        // Make sure style is defined
        if (!annotation.properties || !annotation.properties.style) {
          console.warn("Annotation missing style, adding default style");
          annotation.properties = annotation.properties || {};
          annotation.properties.style = {
            color: "#3880ff",
            opacity: 0.5,
          };
        }

        const style = annotation.properties.style;
        console.log(`Annotation style:`, style);

        const geomType = annotation.geometry.type.toLowerCase();
        console.log(`Adding annotation of type ${geomType}:`, annotation);

        if (geomType.includes("linestring")) {
          console.log(`Creating line layer with color: ${style.color}`);
          map.addLayer({
            id: annotation.id,
            type: "line",
            source: annotation.id,
            paint: {
              "line-color": style.color || "#3880ff",
              "line-opacity": style.opacity || 0.8,
              "line-width": style.width || 3,
            },
          });
        } else if (geomType.includes("point")) {
          console.log(`Creating point layer with color: ${style.color}`);
          map.addLayer({
            id: annotation.id,
            type: "circle",
            source: annotation.id,
            paint: {
              "circle-color": style.color || "#3880ff",
              "circle-opacity": style.opacity || 0.8,
              "circle-radius": style.radius || 5,
            },
          });
        } else if (geomType.includes("polygon")) {
          console.log(`Creating polygon layer with color: ${style.color}`);
          map.addLayer({
            id: annotation.id,
            type: "fill",
            source: annotation.id,
            paint: {
              "fill-color": style.color || "#3880ff",
              "fill-opacity": style.opacity || 0.5,
              "fill-outline-color": style.color || "#3880ff",
            },
          });
          console.log(`Polygon layer created with ID: ${annotation.id}`);
        } else {
          console.warn(`Unknown geometry type: ${geomType}`);
        }

        console.log(`FINISH addAnnotationLayer for ID: ${annotation.id}`);
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

        if (!map.getSource(layerId)) {
          map.addSource(layerId, {
            type: "vector",
            tiles: [sourceUrl],
            minzoom: 0,
            maxzoom: 22,
          });
        }

        const savedConfig = layerConfigs[layerId];
        const defaultStyle = {
          color: "#0080ff",
          opacity: 0.5,
          radius: 6,
          width: 2,
        };

        const style = savedConfig?.style || defaultStyle;

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

  useEffect(() => {
    const currentMap = mapRef?.current;

    return () => {
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

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: false,
        point: false,
        line_string: false,
        trash: false,
      },
      styles: [
        // ACTIVE (being drawn)
        // line stroke
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
        // polygon fill
        {
          id: "gl-draw-polygon-fill-active",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["==", "active", "true"]],
          paint: {
            "fill-color": "#3880ff",
            "fill-opacity": 0.1,
          },
        },
        // polygon outline
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
        // vertex points
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
        // midpoints
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

        // INACTIVE (static, already drawn)
        // make the inactive styles transparent to hide them
        // line stroke - HIDDEN
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
            "line-color": "transparent",
            "line-width": 0,
            "line-opacity": 0,
          },
        },
        // polygon fill - HIDDEN
        {
          id: "gl-draw-polygon-fill",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          paint: {
            "fill-color": "transparent",
            "fill-outline-color": "transparent",
            "fill-opacity": 0,
          },
        },
        // polygon outline - HIDDEN
        {
          id: "gl-draw-polygon-stroke",
          type: "line",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "transparent",
            "line-width": 0,
            "line-opacity": 0,
          },
        },
        // point - HIDDEN
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
            "circle-radius": 0,
            "circle-color": "transparent",
            "circle-opacity": 0,
          },
        },
      ],
    });

    map.addControl(draw);
    drawRef.current = draw;

    try {
      const savedAnnotations = localStorage.getItem("mapAnnotations");
      if (savedAnnotations) {
        const parsed = JSON.parse(savedAnnotations);
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

        const annotations = data.features.map((feature) => {
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

        // Create custom layers for newly drawn features
        if (map && drawRef.current) {
          // For each annotation, ensure it has a custom layer
          annotations.forEach((annotation) => {
            // Check if we already have a layer for this annotation
            if (!map.getLayer(annotation.id)) {
              console.log(
                `Creating custom layer for new annotation: ${annotation.id}`
              );
              addAnnotationLayer(map, annotation);
            }
          });
        }
      } catch (err) {
        console.error("Error in updateAnnotations:", err);
      }

      const selected = drawRef.current.getSelected();
      if (selected.features.length === 1) {
        const selectedFeature = selected.features[0];
        setSelectedAnnotation(selectedFeature as Annotation);
        setIsStyleModalOpen(true);
      } else {
        setSelectedAnnotation(null);
        setIsStyleModalOpen(false);
      }
    }

    // IMPORTANT: Register event handlers in this order
    // First our direct handler for creating custom layers immediately
    map.on("draw.create", (e: { features: GeoJSON.Feature[] }) => {
      console.log("Direct draw.create handler called with:", e);
      if (!e.features.length) return;

      e.features.forEach((feature) => {
        // Ensure the feature has an ID
        const id = String(
          feature.id ||
            `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        );

        console.log(`Directly creating custom layer for new feature: ${id}`);

        // Set default style based on geometry type
        let defaultStyle: Annotation["properties"]["style"] = {
          color: "#3880ff",
          opacity: 0.5,
        };

        if (feature.geometry?.type.includes("Line")) {
          defaultStyle = {
            color: "#3880ff",
            opacity: 0.8,
            width: 3,
          } as Annotation["properties"]["style"];
        } else if (feature.geometry?.type.includes("Point")) {
          defaultStyle = {
            color: "#3880ff",
            opacity: 0.8,
            radius: 5,
          } as Annotation["properties"]["style"];
        }

        // Create an annotation object with styling
        const annotation: Annotation = {
          ...feature,
          id,
          properties: {
            ...feature.properties,
            style: defaultStyle,
          },
        };

        // Directly create the custom layer
        try {
          addAnnotationLayer(map, annotation);
          console.log(`Successfully created custom layer with ID: ${id}`);
        } catch (err) {
          console.error(`Error creating custom layer for new feature:`, err);
        }
      });
    });

    // Then register the updateAnnotations handler for state management
    map.on("draw.create", updateAnnotations);
    map.on("draw.update", updateAnnotations);
    map.on("draw.delete", updateAnnotations);
    map.on("draw.selectionchange", updateAnnotations);

    return () => {
      // Clean up all handlers
      map.off("draw.create", updateAnnotations);
      map.off("draw.update", updateAnnotations);
      map.off("draw.delete", updateAnnotations);
      map.off("draw.selectionchange", updateAnnotations);

      // Also remove our direct create handler
      map.off("draw.create", () => {});

      try {
        if (map && drawRef.current && map.getStyle()) {
          map.removeControl(drawRef.current);
          drawRef.current = null;
        }
      } catch (err) {
        console.warn("Error removing draw control during cleanup:", err);
      }
    };
  }, [mapRef, isMapReady, addAnnotationLayer]);

  const deleteSelectedAnnotations = useCallback(() => {
    if (!drawRef.current || !mapRef.current) return;
    const draw = drawRef.current;
    const map = mapRef.current;

    const selectedIds = draw.getSelectedIds();
    if (selectedIds.length === 0) return;

    draw.trash();

    const remainingFeatures = draw.getAll().features;

    if (remainingFeatures.length === 0) {
      setAnnotations([]);
      localStorage.removeItem("mapAnnotations");
      console.log("All annotations deleted, removing from local storage");
    } else {
      const updatedAnnotations = remainingFeatures.map((feature) => {
        return {
          ...feature,
          id: String(feature.id),
          properties: feature.properties || {},
        } as Annotation;
      });

      setAnnotations(updatedAnnotations);
      localStorage.setItem(
        "mapAnnotations",
        JSON.stringify(updatedAnnotations)
      );
      console.log("Updated annotations after deletion:", updatedAnnotations);
    }

    selectedIds.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
  }, [mapRef, drawRef]);

  const updateAnnotationStyle = (
    annotationId: string,
    newStyle: LayerStyle
  ) => {
    if (!mapRef.current || !drawRef.current) return;
    const map = mapRef.current;
    const draw = drawRef.current;

    // Find and update the annotation in state
    const annotationIndex = annotations.findIndex(
      (ann) => ann.id === annotationId
    );
    if (annotationIndex === -1) return;

    console.log(
      "Updating annotation style for:",
      annotationId,
      "New style:",
      newStyle
    );

    // Preserve the current geometry and properties before updating
    const currentFeature = draw.get(annotationId);
    if (!currentFeature) {
      console.error(`Feature ${annotationId} not found in draw control`);
      return;
    }

    console.log("Current feature before update:", currentFeature);

    // Remember selected IDs to restore selection later
    const selectedIds = draw.getSelectedIds();

    // Create updated annotations array with new style
    const updatedAnnotations = annotations.map((annotation, index) => {
      if (index === annotationIndex) {
        return {
          ...annotation,
          properties: {
            ...annotation.properties,
            style: newStyle,
          },
        };
      }
      return annotation;
    });

    // Update state and localStorage
    setAnnotations(updatedAnnotations);
    localStorage.setItem("mapAnnotations", JSON.stringify(updatedAnnotations));

    // IMPORTANT: First clean up ALL existing handlers for ALL annotations
    // This prevents duplicate handlers which cause the duplicate visualization issue
    map.off("draw.update", () => {});

    // Clean up any existing layers for this annotation
    if (map.getLayer(annotationId)) {
      map.removeLayer(annotationId);
    }
    if (map.getSource(annotationId)) {
      map.removeSource(annotationId);
    }

    // Create a combined feature with original geometry and new style
    const featureWithStyle = {
      ...currentFeature,
      properties: {
        ...currentFeature.properties,
        style: newStyle,
      },
    };

    // Update in the draw control
    draw.delete(annotationId);
    draw.add(featureWithStyle);

    // Get the updated annotation with the new style
    const updatedAnnotation = updatedAnnotations[annotationIndex];

    // Create a custom layer for visualization with the correct style
    try {
      console.log(
        "Creating custom layer for:",
        annotationId,
        "with style:",
        newStyle
      );

      // Add the GeoJSON source for our custom layer
      map.addSource(annotationId, {
        type: "geojson",
        data: updatedAnnotation,
      });

      // Get geometry type
      const geomType = updatedAnnotation.geometry?.type.toLowerCase() || "";
      console.log("Geometry type:", geomType);

      // Add styled layer based on geometry type
      if (geomType.includes("polygon")) {
        map.addLayer({
          id: annotationId,
          type: "fill",
          source: annotationId,
          paint: {
            "fill-color": newStyle.color,
            "fill-opacity": newStyle.opacity,
            "fill-outline-color": newStyle.color,
          },
        });
        console.log("Added polygon layer with color:", newStyle.color);
      } else if (geomType.includes("linestring")) {
        map.addLayer({
          id: annotationId,
          type: "line",
          source: annotationId,
          paint: {
            "line-color": newStyle.color,
            "line-opacity": newStyle.opacity,
            "line-width": newStyle.width || 3,
          },
        });
        console.log("Added line layer with color:", newStyle.color);
      } else if (geomType.includes("point")) {
        map.addLayer({
          id: annotationId,
          type: "circle",
          source: annotationId,
          paint: {
            "circle-color": newStyle.color,
            "circle-opacity": newStyle.opacity,
            "circle-radius": newStyle.radius || 5,
          },
        });
        console.log("Added circle layer with color:", newStyle.color);
      }
    } catch (err) {
      console.error("Error creating custom layer:", err);
    }

    // Restore selection if needed
    if (selectedIds.includes(annotationId)) {
      draw.changeMode("simple_select", { featureIds: selectedIds });
    }

    // Creating a single update handler that handles ALL annotations
    // This is key to preventing duplicate handlers and visuals
    function handleDrawUpdate(e: { features: GeoJSON.Feature[] }) {
      // Process all features, not just one specific annotation
      e.features.forEach((feature) => {
        const featureId = feature.id as string;
        if (!featureId) return;

        // Find the annotation in our state
        const annotationIdx = annotations.findIndex((a) => a.id === featureId);
        if (annotationIdx === -1) return;

        // Get the stored style for this annotation
        const annotationStyle = annotations[annotationIdx].properties?.style;
        if (!annotationStyle) return;

        console.log("Feature updated, syncing custom layer:", featureId);

        if (map.getSource(featureId)) {
          const updatedFeature = {
            ...feature,
            properties: {
              ...feature.properties,
              style: annotationStyle,
            },
          };

          (map.getSource(featureId) as maplibregl.GeoJSONSource).setData(
            updatedFeature
          );
        }
      });
    }

    map.on("draw.update", handleDrawUpdate);

    console.log(
      "Custom style layer created for:",
      annotationId,
      "Style applied:",
      newStyle
    );
  };

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
            deleteSelectedAnnotations();
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
      try {
        draw.changeMode("simple_select");
      } catch (e) {
        console.error("Could not recover to simple_select mode:", e);
      }
    }
  }, [selectedEditItem, mapRef, deleteSelectedAnnotations]);

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
        onClose={() => {
          setIsStyleModalOpen(false);
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
