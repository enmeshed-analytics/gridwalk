import { useState, useCallback, useEffect } from "react";
import { LayerConfig, LayerStyle } from "../types";

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

interface UseLayerProps {
  mapRef?: React.MutableRefObject<maplibregl.Map | null>;
  isMapReady?: boolean;
  workspaceId: string;
}

export function useLayer({ mapRef, workspaceId }: UseLayerProps) {
  const [layerConfigs, setLayerConfigs] = useState<{
    [key: string]: LayerConfig;
  }>({});
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [activeLayerIds, setActiveLayerIds] = useState<string[]>([]);

  // Load saved layer configs
  useEffect(() => {
    const savedConfigs = localStorage.getItem("layerConfigs");
    if (savedConfigs) {
      setLayerConfigs(JSON.parse(savedConfigs));
    }
  }, []);

  // Save layer configs when they change
  useEffect(() => {
    localStorage.setItem("layerConfigs", JSON.stringify(layerConfigs));
  }, [layerConfigs]);

  const updateLayerStyle = useCallback(
    (layerId: string, style: LayerStyle) => {
      if (!mapRef?.current) return;
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

        // Add to active layer IDs
        setActiveLayerIds((prev) => [...prev, layerId]);

        return geomType;
      } catch (error) {
        console.error("Error adding map layer:", error);
        throw error;
      }
    },
    [layerConfigs]
  );

  const removeMapLayer = useCallback((map: maplibregl.Map, layerId: string) => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(layerId)) {
      map.removeSource(layerId);
    }

    // Remove from active layer IDs
    setActiveLayerIds((prev) => prev.filter((id) => id !== layerId));
  }, []);

  const handleStyleClick = useCallback(
    (layerId: string) => {
      console.log("Style click triggered for layer:", layerId);
      console.log("Current layer configs:", layerConfigs);
      setSelectedLayerId(layerId);
      setIsStyleModalOpen(true);
    },
    [layerConfigs]
  );

  // Generate a source URL for a layer
  const getLayerSourceUrl = useCallback(
    (layerName: string) => {
      return `${process.env.NEXT_PUBLIC_GRIDWALK_API}/workspaces/${workspaceId}/connections/primary/sources/${layerName}/tiles/{z}/{x}/{y}`;
    },
    [workspaceId]
  );

  // Generate a geometry type URL for a layer
  const getLayerGeomTypeUrl = useCallback(
    (layerName: string) => {
      return `${process.env.NEXT_PUBLIC_GRIDWALK_API}/workspaces/${workspaceId}/connections/primary/sources/${layerName}/tiles/geometry`;
    },
    [workspaceId]
  );

  // Generate a layer ID
  const getLayerId = useCallback(
    (layerName: string) => {
      return `layer-${workspaceId}-${layerName}`;
    },
    [workspaceId]
  );

  return {
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
  };
}
