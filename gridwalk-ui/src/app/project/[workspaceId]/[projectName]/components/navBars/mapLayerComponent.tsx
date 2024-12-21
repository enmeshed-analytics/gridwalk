import React, { useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import type { Feature, Polygon } from "geojson";
import { WorkspaceConnection } from "./types";

interface LayerProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
  selectedButtons: Record<number, boolean>;
  connections: WorkspaceConnection[];
}

const LONDON_COORDS = [-0.1278, 51.5074];

const MapLayerControl: React.FC<LayerProps> = ({
  mapRef,
  selectedButtons,
  connections,
}) => {
  const activeLayerIds = useRef<string[]>([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
      const connection = connections[index];
      if (!connection) return;

      const layerId = `box-${String(connection)}`;

      // Create the GeoJSON data for the box
      const geojsonData: Feature<Polygon> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [LONDON_COORDS[0] - 0.1, LONDON_COORDS[1] - 0.1],
              [LONDON_COORDS[0] + 0.1, LONDON_COORDS[1] - 0.1],
              [LONDON_COORDS[0] + 0.1, LONDON_COORDS[1] + 0.1],
              [LONDON_COORDS[0] - 0.1, LONDON_COORDS[1] + 0.1],
              [LONDON_COORDS[0] - 0.1, LONDON_COORDS[1] - 0.1],
            ],
          ],
        },
      };

      try {
        // Add source
        map.addSource(layerId, {
          type: "geojson",
          data: geojsonData,
        });

        // Add box layer
        map.addLayer({
          id: layerId,
          type: "fill",
          source: layerId,
          paint: {
            "fill-color": "#0080ff",
            "fill-opacity": 0.5,
          },
        });

        // Track the added layer
        activeLayerIds.current.push(layerId);
      } catch (err) {
        console.error("Error adding layer:", err);
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
  }, [mapRef, selectedButtons, connections]);

  // Handle style changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleStyleLoad = () => {
      // Re-render after style change
      map.once("style.load", () => {
        // Force re-render after style load
        activeLayerIds.current = [];
      });
    };

    map.on("style.load", handleStyleLoad);
    return () => {
      map.off("style.load", handleStyleLoad);
    };
  }, [mapRef]);

  return null;
};

export default MapLayerControl;
