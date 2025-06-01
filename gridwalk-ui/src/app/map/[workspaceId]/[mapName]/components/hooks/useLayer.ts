import { useState, useCallback, useEffect } from "react";
import { LayerConfig, LayerStyle } from "../types";
import { LayerConfigType, UseLayerProps } from "./types";

export function useLayer({
  mapRef,
  workspaceId,
  selectedLayers = {},
  workspaceConnections = [],
}: UseLayerProps) {
  const [layerConfigs, setLayerConfigs] = useState<{
    [key: string]: LayerConfig;
  }>({});
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [layerOrder, setLayerOrder] = useState<string[]>([]);

  const getActiveLayerIds = useCallback(() => {
    return Object.entries(selectedLayers)
      .filter(([, isSelected]) => isSelected)
      .map(([index]) => {
        const connection = workspaceConnections[Number(index)];
        return connection ? `layer-${workspaceId}-${String(connection)}` : null;
      })
      .filter(Boolean) as string[];
  }, [selectedLayers, workspaceConnections, workspaceId]);

  useEffect(() => {
    const savedConfigs = localStorage.getItem("layerConfigs");
    if (savedConfigs) {
      setLayerConfigs(JSON.parse(savedConfigs));
    }

    const savedOrder = localStorage.getItem("layerOrder");
    if (savedOrder) {
      setLayerOrder(JSON.parse(savedOrder));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("layerConfigs", JSON.stringify(layerConfigs));
  }, [layerConfigs]);

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

  // Add a map layer
  const addMapLayer = useCallback(
    async (
      map: maplibregl.Map,
      layerId: string,
      sourceUrl: string,
      sourceLayerName: string,
      geomTypeUrl: string
    ) => {
      try {
        console.log(`Adding layer: ${layerId} from source: ${sourceUrl}`);

        // Always check if the layer exists first
        let layerExists = false;
        try {
          layerExists = !!map.getLayer(layerId);
        } catch (e) {
          console.log(`Error checking if layer ${layerId} exists:`, e);
          layerExists = false;
        }

        if (layerExists) {
          console.log(`Layer ${layerId} already exists, making it visible`);
          try {
            map.setLayoutProperty(layerId, "visibility", "visible");
            return layerConfigs[layerId]?.geomType || "unknown";
          } catch (e) {
            console.error(`Error making layer ${layerId} visible:`, e);
            // Layer reference might be corrupted, remove and recreate it
            try {
              map.removeLayer(layerId);
              console.log(`Removed corrupted layer ${layerId}`);
              layerExists = false;
            } catch (err) {
              console.error(
                `Failed to remove corrupted layer ${layerId}:`,
                err
              );
            }
          }
        }

        // Get geometry type
        let geomType: string;
        try {
          const response = await fetch(geomTypeUrl);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch geometry type: ${response.statusText}`
            );
          }
          geomType = await response.text();
        } catch (err) {
          console.error(`Error fetching geometry type for ${layerId}:`, err);
          geomType = "unknown"; // Default
        }

        // Source ID
        const sourceId = getSourceId(layerId.split("-").pop() || "");

        // Check source exists
        let sourceExists = false;
        try {
          sourceExists = !!map.getSource(sourceId);
        } catch (e) {
          console.log(`Error checking if source ${sourceId} exists:`, e);
          sourceExists = false;
        }

        // Create or recreate source if needed
        if (!sourceExists) {
          try {
            console.log(`Adding source: ${sourceId}`);
            map.addSource(sourceId, {
              type: "vector",
              tiles: [sourceUrl],
              minzoom: 0,
              maxzoom: 22,
            });
          } catch (e) {
            console.error(`Error adding source ${sourceId}:`, e);
            // Try to remove it first if it might be corrupted
            try {
              map.removeSource(sourceId);
              console.log(`Removed potentially corrupted source ${sourceId}`);
              map.addSource(sourceId, {
                type: "vector",
                tiles: [sourceUrl],
                minzoom: 0,
                maxzoom: 22,
              });
            } catch (err) {
              console.error(`Failed to recreate source ${sourceId}:`, err);
              throw new Error(
                `Cannot add layer ${layerId}: source creation failed`
              );
            }
          }
        }

        // Create layer style configuration
        const savedConfig = layerConfigs[layerId];
        const defaultStyle = {
          color: "#0080ff",
          opacity: 0.5,
          radius: 6,
          width: 2,
        };
        const style = savedConfig?.style || defaultStyle;

        // Define layer config based on geometry type
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
          default: // Default to point (circle)
            layerConfig = {
              type: "circle",
              paint: {
                "circle-color": style.color,
                "circle-opacity": style.opacity,
                "circle-radius": style.radius || 6,
              },
            };
        }

        // Get first symbol layer for proper layer ordering
        let firstSymbolId;
        try {
          firstSymbolId = getFirstLayerId(map);
        } catch (e) {
          console.error(`Error getting first symbol layer:`, e);
          firstSymbolId = undefined;
        }

        // Try one more time to see if the layer exists
        try {
          if (map.getLayer(layerId)) {
            console.log(
              `Layer ${layerId} was created by another process, making visible`
            );
            map.setLayoutProperty(layerId, "visibility", "visible");
            return geomType;
          }
        } catch (e) {
          console.log(`Final layer existence check error:`, e);
        }

        // Create the layer spec
        const layerSpec = {
          id: layerId,
          source: sourceId,
          "source-layer": sourceLayerName,
          layout: {
            visibility: "visible",
          },
          ...layerConfig,
        };

        // Add the layer with robust error handling
        try {
          console.log(`Adding layer ${layerId} to map`);
          map.addLayer(
            layerSpec as maplibregl.LayerSpecification,
            firstSymbolId
          );
        } catch (e) {
          console.error(`Error adding layer ${layerId}:`, e);
          // If adding failed, try removing and re-adding
          try {
            if (map.getLayer(layerId)) {
              map.removeLayer(layerId);
            }
            // Try again
            map.addLayer(
              layerSpec as maplibregl.LayerSpecification,
              firstSymbolId
            );
            console.log(`Successfully re-added layer ${layerId} after error`);
          } catch (err) {
            console.error(`Final attempt to add layer ${layerId} failed:`, err);
            throw new Error(`Could not add layer ${layerId}`);
          }
        }

        // Store layer config
        if (!savedConfig) {
          setLayerConfigs((prev) => ({
            ...prev,
            [layerId]: {
              layerId,
              sourceId,
              geomType,
              style,
            },
          }));
        }

        // Update layer order
        setLayerOrder((prev) => {
          const newOrder = prev.filter((id) => id !== layerId);
          return [layerId, ...newOrder];
        });

        return geomType;
      } catch (error) {
        console.error(`Error in addMapLayer for ${layerId}:`, error);
        throw error;
      }
    },
    [layerConfigs, getFirstLayerId, getSourceId]
  );

  // Remove a map layer
  const removeMapLayer = useCallback(
    (map: maplibregl.Map, layerId: string) => {
      console.log(`Removing layer: ${layerId}`);

      try {
        // First try to hide the layer
        if (map.getLayer(layerId)) {
          console.log(`Setting ${layerId} visibility to none`);
          map.setLayoutProperty(layerId, "visibility", "none");
        }

        // Then try to actually remove it
        try {
          const sourceId =
            layerConfigs[layerId]?.sourceId ||
            getSourceId(layerId.split("-").pop() || "");

          console.log(`Actually removing layer ${layerId}`);
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }

          // Only remove source if it's not used elsewhere
          const isSourceUsedElsewhere = Object.values(layerConfigs).some(
            (config) =>
              config.sourceId === sourceId && config.layerId !== layerId
          );

          if (!isSourceUsedElsewhere && map.getSource(sourceId)) {
            console.log(`Removing source ${sourceId}`);
            map.removeSource(sourceId);
          }
        } catch (err) {
          // If removing fails, at least the layer is hidden
          console.error(`Error fully removing layer ${layerId}:`, err);
        }

        // Update layer order regardless
        setLayerOrder((prev) => prev.filter((id) => id !== layerId));

        console.log(`Successfully removed layer: ${layerId}`);
      } catch (err) {
        console.error(`Error in removeMapLayer for ${layerId}:`, err);
      }
    },
    [layerConfigs, getSourceId]
  );

  // Apply layer order
  const applyLayerOrder = useCallback(() => {
    if (!mapRef?.current) return;
    const map = mapRef.current;

    // Get the first symbol layer as the reference point
    const firstSymbolId = getFirstLayerId(map);
    if (!firstSymbolId) return;

    console.log("Applying layer order:", layerOrder);

    // Get all active layers from selectedLayers
    const activeLayerIds = getActiveLayerIds();
    console.log("Active layer IDs:", activeLayerIds);

    // Filter layerOrder to only include active layers and ensure they exist on the map
    const orderedActiveLayers = layerOrder.filter(
      (id) => activeLayerIds.includes(id) && map.getLayer(id)
    );
    console.log("Ordered active layers:", orderedActiveLayers);

    // Apply the order from bottom to top (reverse of layerOrder)
    [...orderedActiveLayers].reverse().forEach((layerId) => {
      try {
        console.log(
          `Moving layer ${layerId} above previous and below ${firstSymbolId}`
        );
        map.moveLayer(layerId, firstSymbolId);
      } catch (err) {
        console.error(`Error moving layer ${layerId}:`, err);
      }
    });
  }, [mapRef, layerOrder, getFirstLayerId, getActiveLayerIds]);

  // Add an effect to reapply layer order whenever it changes
  useEffect(() => {
    if (mapRef?.current && layerOrder.length > 0) {
      applyLayerOrder();
    }
  }, [layerOrder, mapRef, applyLayerOrder]);

  // Move a layer to the top
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

  // Force show all selected layers
  const forceShowAllSelectedLayers = useCallback(
    (map: maplibregl.Map) => {
      console.log("Forcing visibility of all selected layers");

      // Process each selected layer
      Object.entries(selectedLayers)
        .filter(([, isSelected]) => isSelected)
        .forEach(([index]) => {
          const connection = workspaceConnections[Number(index)];
          if (!connection) return;

          const layerName = String(connection);
          const layerId = getLayerId(layerName);

          let layerExists = false;
          try {
            layerExists = !!map.getLayer(layerId);
          } catch (e) {
            console.log(`Error checking if layer ${layerId} exists:`, e);
            layerExists = false;
          }

          if (layerExists) {
            // If layer exists, just make it visible
            try {
              console.log(`Forcing layer ${layerId} to be visible`);
              map.setLayoutProperty(layerId, "visibility", "visible");
            } catch (e) {
              console.error(`Error making layer ${layerId} visible:`, e);
              layerExists = false; // Mark as not existing to recreate it
            }
          }

          if (!layerExists) {
            // If layer doesn't exist, create it
            const sourceUrl = getLayerSourceUrl(layerName);
            const geomTypeUrl = getLayerGeomTypeUrl(layerName);

            // Add the layer with error handling
            addMapLayer(map, layerId, sourceUrl, layerName, geomTypeUrl)
              .then(() =>
                console.log(`Successfully added missing layer ${layerId}`)
              )
              .catch((err) =>
                console.error(`Failed to add missing layer ${layerId}:`, err)
              );
          }
        });
    },
    [
      selectedLayers,
      workspaceConnections,
      getLayerId,
      getLayerSourceUrl,
      getLayerGeomTypeUrl,
      addMapLayer,
    ]
  );

  return {
    layerConfigs,
    selectedLayerId,
    isStyleModalOpen,
    getActiveLayerIds,
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
    forceShowAllSelectedLayers,
  };
}
