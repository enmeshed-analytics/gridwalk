import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";

interface LayerProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
  selectedButtons: Record<number, boolean>;
  connections: string[]; // Array of layer names
  workspaceId: string;
}

// Helper function to get cookie value
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
}

const MapLayerControl: React.FC<LayerProps> = ({
  mapRef,
  selectedButtons,
  connections,
  workspaceId,
}) => {
  const activeLayerIds = useRef<string[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Get auth token on mount
  useEffect(() => {
    const token = getCookie("sid");
    console.log("Retrieved auth token:", token);
    setAuthToken(token);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !authToken) return;

    console.log("Current connections:", connections);
    console.log("Selected buttons:", selectedButtons);

    // Clean up old layers first
    activeLayerIds.current.forEach((id) => {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    });
    activeLayerIds.current = [];

    // Add new layers for selected buttons
    Object.entries(selectedButtons).forEach(([indexStr, isSelected]) => {
      if (!isSelected) return;

      const index = parseInt(indexStr);
      const layerName = connections[index];

      if (!layerName) {
        console.error(`No layer found for index ${index}`);
        return;
      }

      // Generate unique layer ID
      const layerId = `layer-${workspaceId}-${layerName}`;
      console.log("Adding layer:", layerId);

      try {
        // Strip file extensions for the source-layer name
        const sourceLayerName = layerName
          .replace(".gpkg", "")
          .replace(".json", "");

        // Add vector tile source
        // Log workspace ID to debug
        console.log("Using workspace ID:", workspaceId);
        const url = new URL(window.location.href);
        const pathParts = url.pathname.split("/");
        const workspaceIdFromUrl = pathParts[2]; // Get workspace ID from URL path
        console.log("Workspace ID from URL:", workspaceIdFromUrl);

        const sourceUrl = `/workspaces/${workspaceIdFromUrl}/connections/primary/sources/${layerName}/tiles/{z}/{x}/{y}`;
        console.log("Source URL:", sourceUrl);

        // Set up transform function for the map
        map.setTransformRequest((url: string) => {
          console.log("Making request with token:", authToken);
          return {
            url,
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          };
        });

        // Add the source
        map.addSource(layerId, {
          type: "vector",
          tiles: [sourceUrl],
          minzoom: 0,
          maxzoom: 22,
        });

        // Add layer using the vector tile source
        map.addLayer({
          id: layerId,
          type: "fill",
          source: layerId,
          "source-layer": sourceLayerName,
          paint: {
            "fill-color": "#0080ff",
            "fill-opacity": 0.5,
          },
        });

        // Track the added layer
        activeLayerIds.current.push(layerId);
      } catch (err) {
        console.error("Error adding layer:", err);
        console.error("Layer details:", {
          layerId,
          layerName,
          workspaceId,
        });
      }
    });

    // Cleanup function
    return () => {
      if (!map) return;
      const currentIds = [...activeLayerIds.current];
      currentIds.forEach((id) => {
        try {
          if (map.getLayer(id)) {
            map.removeLayer(id);
          }
          if (map.getSource(id)) {
            map.removeSource(id);
          }
        } catch (err) {
          console.error("Error cleaning up layer:", err);
        }
      });
    };
  }, [mapRef, selectedButtons, connections, workspaceId, authToken]);

  return null;
};

export default MapLayerControl;
