import { useCallback, useEffect, useState, useRef } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { LayerStyle } from "../types";

export interface Annotation extends GeoJSON.Feature {
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

interface AnnotationsProps {
  mapRef?: React.MutableRefObject<maplibregl.Map | null>;
  isMapReady?: boolean;
}

export function useAnnotations({ mapRef, isMapReady }: AnnotationsProps = {}) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<Annotation | null>(null);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const drawRef = useRef<MapboxDraw | null>(null);

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

  // Effect to initialise the draw control
  useEffect(() => {
    if (!mapRef?.current || !isMapReady) return;

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
            // First check if the source exists but needs updating
            if (map.getSource(annotation.id)) {
              // Update the source data with the new position
              (
                map.getSource(annotation.id) as maplibregl.GeoJSONSource
              ).setData(annotation);
            }
            // If no layer exists at all, create one
            else if (!map.getLayer(annotation.id)) {
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

  // Effect to save annotations whenever they change
  useEffect(() => {
    if (annotations.length > 0) {
      localStorage.setItem("mapAnnotations", JSON.stringify(annotations));
    }
  }, [annotations]);

  const deleteSelectedAnnotations = useCallback(() => {
    if (!drawRef.current || !mapRef?.current) return;
    const draw = drawRef.current;
    const map = mapRef.current;

    const selectedIds = draw.getSelectedIds();
    if (selectedIds.length === 0) return;

    setIsStyleModalOpen(false);
    setSelectedAnnotation(null);

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
  }, [mapRef]);

  const updateAnnotationStyle = useCallback(
    (annotationId: string, newStyle: LayerStyle) => {
      if (!mapRef?.current || !drawRef.current) return;
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
      localStorage.setItem(
        "mapAnnotations",
        JSON.stringify(updatedAnnotations)
      );

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
          const annotationIdx = annotations.findIndex(
            (a) => a.id === featureId
          );
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
    },
    [mapRef, annotations]
  );

  const setDrawMode = useCallback(
    (mode: string) => {
      if (!drawRef.current || !mapRef?.current) return;
      const draw = drawRef.current;

      console.log("Changing to drawing mode:", mode);

      try {
        switch (mode) {
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
    },
    [mapRef, deleteSelectedAnnotations]
  );

  return {
    annotations,
    selectedAnnotation,
    isStyleModalOpen,
    setIsStyleModalOpen,
    addAnnotationLayer,
    deleteSelectedAnnotations,
    updateAnnotationStyle,
    setSelectedAnnotation,
    setDrawMode,
    drawRef,
  };
}
