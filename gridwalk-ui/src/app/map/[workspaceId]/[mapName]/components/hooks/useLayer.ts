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
  // Track layer ordering to maintain consistent z-index
  const [layerOrder, setLayerOrder] = useState<string[]>([]);

  // Load saved layer configs
  useEffect(() => {
    const savedConfigs = localStorage.getItem("layerConfigs");
    if (savedConfigs) {
      setLayerConfigs(JSON.parse(savedConfigs));
    }

    // Load saved layer order if available
    const savedOrder = localStorage.getItem("layerOrder");
    if (savedOrder) {
      setLayerOrder(JSON.parse(savedOrder));
    }
  }, []);

  // Save layer configs when they change
  useEffect(() => {
    localStorage.setItem("layerConfigs", JSON.stringify(layerConfigs));
  }, [layerConfigs]);

  // Save layer order when it changes
  useEffect(() => {
    localStorage.setItem("layerOrder", JSON.stringify(layerOrder));
  }, [layerOrder]);

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

  // Helper function to find the first symbol layer in the map style
  const getFirstLayerId = useCallback((map: maplibregl.Map) => {
    const layers = map.getStyle().layers;
    // Find the index of the first symbol layer in the map style
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].type === "symbol") {
        return layers[i].id;
      }
    }
    return undefined; // If no symbol layer is found
  }, []);

  // Generate a source ID that's different from the layer ID
  const getSourceId = useCallback(
    (layerName: string) => {
      return `source-${workspaceId}-${layerName}`;
    },
    [workspaceId]
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

        // Create a unique source ID
        const sourceId = getSourceId(layerId.split("-").pop() || "");

        // Only add the source if it doesn't exist
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
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

        // Determine where to insert this layer
        let beforeLayerId: string | undefined;

        // If we have active layers, find the highest one in our layerOrder
        if (activeLayerIds.length > 0 && layerOrder.length > 0) {
          // Find active layers that are already on the map
          const activeOrderedLayers = layerOrder.filter(
            (id) => activeLayerIds.includes(id) && map.getLayer(id)
          );

          if (activeOrderedLayers.length > 0) {
            // Insert before the topmost active layer
            beforeLayerId = activeOrderedLayers[0];
          }
        }

        // If we couldn't find an active layer, use the first symbol layer
        if (!beforeLayerId) {
          beforeLayerId = getFirstLayerId(map);
        }

        // Add layer with basic visibility layout
        const layerSpec = {
          id: layerId,
          source: sourceId, // Use the unique source ID
          "source-layer": sourceLayerName,
          layout: {
            visibility: "visible",
          },
          ...layerConfig,
        };

        // Add the layer to the map
        map.addLayer(layerSpec as maplibregl.LayerSpecification, beforeLayerId);

        // Store the configuration if it doesn't exist
        if (!savedConfig) {
          setLayerConfigs((prev) => ({
            ...prev,
            [layerId]: {
              layerId,
              sourceId, // Store the source ID
              geomType,
              style,
            },
          }));
        }

        // Add to active layer IDs
        setActiveLayerIds((prev) =>
          prev.includes(layerId) ? prev : [...prev, layerId]
        );

        // Add to layer order (at the top)
        setLayerOrder((prev) => {
          const newOrder = prev.filter((id) => id !== layerId);
          return [layerId, ...newOrder]; // New layer goes on top
        });

        return geomType;
      } catch (error) {
        console.error("Error adding map layer:", error);
        throw error;
      }
    },
    [layerConfigs, activeLayerIds, getFirstLayerId, getSourceId, layerOrder]
  );

  const removeMapLayer = useCallback(
    (map: maplibregl.Map, layerId: string) => {
      // Get the source ID from our configs
      const sourceId =
        layerConfigs[layerId]?.sourceId ||
        getSourceId(layerId.split("-").pop() || "");

      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }

      // Check if the source is still being used by other layers before removing
      const isSourceUsedElsewhere = Object.values(layerConfigs).some(
        (config) => config.sourceId === sourceId && config.layerId !== layerId
      );

      if (!isSourceUsedElsewhere && map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }

      // Remove from active layer IDs
      setActiveLayerIds((prev) => prev.filter((id) => id !== layerId));

      // Update layer order
      setLayerOrder((prev) => prev.filter((id) => id !== layerId));
    },
    [layerConfigs, getSourceId]
  );

  // Add this new function to reapply the layer order to the map
  const applyLayerOrder = useCallback(() => {
    if (!mapRef?.current) return;
    const map = mapRef.current;

    // Get the first symbol layer as the reference point
    const firstSymbolId = getFirstLayerId(map);

    // Apply the order from bottom to top (reverse of layerOrder)
    // This ensures correct stacking order
    [...layerOrder].reverse().forEach((layerId) => {
      if (map.getLayer(layerId)) {
        // Move each layer above the previous one and below the symbol layers
        map.moveLayer(layerId, firstSymbolId);
      }
    });
  }, [mapRef, layerOrder, getFirstLayerId]);

  // Add an effect to reapply layer order whenever it changes
  useEffect(() => {
    if (mapRef?.current && layerOrder.length > 0) {
      applyLayerOrder();
    }
  }, [layerOrder, mapRef, applyLayerOrder]);

  // Modify the moveLayerToTop function
  const moveLayerToTop = useCallback(
    (layerId: string) => {
      if (!mapRef?.current) return;
      const map = mapRef.current;

      if (!map.getLayer(layerId)) return;

      // Update our order tracking - move the layer to the front of the array
      setLayerOrder((prev) => {
        const newOrder = prev.filter((id) => id !== layerId);
        return [layerId, ...newOrder]; // Move to the top of our order array
      });

      // Note: The actual move in MapLibre will happen through the useEffect
      // So we don't need to call map.moveLayer here anymore
    },
    [mapRef]
  );

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
    layerOrder,
    setSelectedLayerId,
    setIsStyleModalOpen,
    updateLayerStyle,
    addMapLayer,
    removeMapLayer,
    moveLayerToTop,
    applyLayerOrder,
    handleStyleClick,
    getLayerSourceUrl,
    getLayerGeomTypeUrl,
    getLayerId,
  };
}
