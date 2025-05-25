import { useCallback, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";

export interface SelectedFeature {
  id: string | number | undefined;
  layerId: string;
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry;
}

export interface UseFeatureSelectionProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
  isMapReady: boolean;
  onFeatureClick?: (feature: SelectedFeature | null) => void;
}

export function useFeatureSelection({
  mapRef,
  isMapReady,
  onFeatureClick,
}: UseFeatureSelectionProps) {
  const [selectedFeature, setSelectedFeature] =
    useState<SelectedFeature | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const addGlowEffect = useCallback(
    (map: maplibregl.Map, feature: maplibregl.MapGeoJSONFeature) => {
      const glowLayerId = `${feature.layer.id}-glow`;

      if (map.getLayer(glowLayerId)) {
        map.removeLayer(glowLayerId);
      }

      if (feature.layer.type === "fill") {
        map.addLayer(
          {
            id: glowLayerId,
            type: "line",
            source: feature.layer.source,
            "source-layer": feature.layer["source-layer"],
            filter: ["==", ["get", "id"], feature.id || ["get", "fid"] || 0],
            paint: {
              "line-color": "#00ff88",
              "line-width": 4,
              "line-opacity": 0.8,
              "line-blur": 2,
            },
          },
          feature.layer.id
        );
      } else if (feature.layer.type === "line") {
        map.addLayer(
          {
            id: glowLayerId,
            type: "line",
            source: feature.layer.source,
            "source-layer": feature.layer["source-layer"],
            filter: ["==", ["get", "id"], feature.id || ["get", "fid"] || 0],
            paint: {
              "line-color": "#00ff88",
              "line-width": 8,
              "line-opacity": 0.6,
              "line-blur": 3,
            },
          },
          feature.layer.id
        );
      } else if (feature.layer.type === "circle") {
        map.addLayer(
          {
            id: glowLayerId,
            type: "circle",
            source: feature.layer.source,
            "source-layer": feature.layer["source-layer"],
            filter: ["==", ["get", "id"], feature.id || ["get", "fid"] || 0],
            paint: {
              "circle-color": "transparent",
              "circle-stroke-color": "#00ff88",
              "circle-stroke-width": 6,
              "circle-stroke-opacity": 0.7,
              "circle-radius": ["get", "circle-radius", ["literal", 8]],
            },
          },
          feature.layer.id
        );
      }
    },
    []
  );

  const removeGlowEffect = useCallback(
    (map: maplibregl.Map, layerId: string) => {
      const glowLayerId = `${layerId}-glow`;
      if (map.getLayer(glowLayerId)) {
        map.removeLayer(glowLayerId);
      }
    },
    []
  );

  const handleMapClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!mapRef.current) return;

      // Check if the click originated from a UI element
      const target = e.originalEvent.target as HTMLElement;
      if (
        target &&
        target.closest('button, .sidebar, [role="button"], [data-ui]')
      ) {
        return; // Don't handle feature selection for UI clicks
      }

      const map = mapRef.current;
      const features = map.queryRenderedFeatures(e.point);

      // Filter out base map features - only get our custom layers
      const customFeatures = features.filter((feature) =>
        feature.layer.id.startsWith("layer-")
      );

      if (customFeatures.length > 0) {
        const feature = customFeatures[0];

        const selectedFeature: SelectedFeature = {
          id: feature.id,
          layerId: feature.layer.id,
          properties: feature.properties || {},
          geometry: feature.geometry,
        };

        setSelectedFeature(selectedFeature);
        setIsModalOpen(true);
        onFeatureClick?.(selectedFeature);

        console.log("Selected feature:", selectedFeature);
        map.getCanvas().style.cursor = "pointer";

        // Add glow effect
        addGlowEffect(map, feature);
      } else {
        // Clear selection
        if (selectedFeature) {
          removeGlowEffect(map, selectedFeature.layerId);
        }
        setSelectedFeature(null);
        setIsModalOpen(false);
        onFeatureClick?.(null);
        map.getCanvas().style.cursor = "";
      }
    },
    [mapRef, onFeatureClick, addGlowEffect, removeGlowEffect, selectedFeature]
  );

  const clearSelection = useCallback(() => {
    if (mapRef.current && selectedFeature) {
      const map = mapRef.current;
      removeGlowEffect(map, selectedFeature.layerId);
      map.getCanvas().style.cursor = "";
    }

    setSelectedFeature(null);
    setIsModalOpen(false);
    onFeatureClick?.(null);
  }, [mapRef, onFeatureClick, selectedFeature, removeGlowEffect]);

  // Setup click listener
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    const map = mapRef.current;
    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [mapRef, isMapReady, handleMapClick]);

  return {
    selectedFeature,
    isFeatureModalOpen: isModalOpen,
    clearSelection,
    closeFeatureModal: () => setIsModalOpen(false),
  };
}
