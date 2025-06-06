import { useCallback, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import { SelectedFeature, UseFeatureSelectionProps } from "./types";

export function useFeatureSelection({
  mapRef,
  isMapReady,
  onFeatureClick,
  osApiFeatures = [],
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

      // Filter out base map features - include our custom layers AND OS API layers
      const customFeatures = features.filter(
        (feature) =>
          feature.layer.id.startsWith("layer-") ||
          feature.layer.id.startsWith("os-api-")
      );

      if (customFeatures.length > 0) {
        const feature = customFeatures[0];

        let selectedFeature: SelectedFeature = {
          id: feature.id,
          layerId: feature.layer.id,
          properties: feature.properties || {},
          geometry: feature.geometry,
        };

        // If it's an OS API feature, enhance with full properties
        if (
          feature.layer.id.startsWith("os-api-") &&
          osApiFeatures.length > 0
        ) {
          const fullFeature = osApiFeatures.find(
            (f) =>
              f.properties && f.properties.usrn === feature.properties?.usrn
          );

          if (fullFeature && fullFeature.properties) {
            selectedFeature = {
              ...selectedFeature,
              properties: fullFeature.properties,
            };
          }
        }

        setSelectedFeature(selectedFeature);
        setIsModalOpen(true);
        onFeatureClick?.(selectedFeature);

        console.log("Selected feature:", selectedFeature);
        map.getCanvas().style.cursor = "pointer";

        // Only add glow effect for regular layers, not OS API features
        if (feature.layer.id.startsWith("layer-")) {
          addGlowEffect(map, feature);
        }
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
    [
      mapRef,
      onFeatureClick,
      addGlowEffect,
      removeGlowEffect,
      selectedFeature,
      osApiFeatures,
    ]
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
