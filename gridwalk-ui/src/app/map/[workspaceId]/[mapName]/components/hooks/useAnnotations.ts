import { useCallback, useEffect, useState, useRef } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { LayerStyle } from "../types";
import { getCollectionFeaturesByBbox } from "./osApiUtils";
import { Annotation, AnnotationsProps } from "./types";

export function useAnnotations({
  mapRef,
  isMapReady,
  onDrawComplete,
}: AnnotationsProps = {}) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<Annotation | null>(null);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const drawRef = useRef<MapboxDraw | null>(null);

  // Add a state to track if we're in bbox mode...
  // This needs to be used for the OS DataHub query
  const [isBboxMode, setIsBboxMode] = useState(false);

  const [osApiFeatures, setOsApiFeatures] = useState<GeoJSON.Feature[]>([]);
  const [osApiLayerId, setOsApiLayerId] = useState<string | null>(null);

  const addOSApiLayer = useCallback(
    (map: maplibregl.Map, features: GeoJSON.Feature[], layerId: string) => {
      try {
        console.log(
          `Adding OS API layer: ${layerId} with ${features.length} features`
        );

        // Remove existing layers and sources
        if (map.getLayer(`${layerId}-line`)) {
          map.removeLayer(`${layerId}-line`);
        }
        if (map.getLayer(`${layerId}-point`)) {
          map.removeLayer(`${layerId}-point`);
        }
        if (map.getSource(layerId)) {
          map.removeSource(layerId);
        }

        // Create GeoJSON feature collection
        const featureCollection: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: features,
        };

        map.addSource(layerId, {
          type: "geojson",
          data: featureCollection,
        });

        // Add line layer for line geometries
        map.addLayer({
          id: `${layerId}-line`,
          type: "line",
          source: layerId,
          filter: ["==", "$type", "LineString"],
          paint: {
            "line-color": "#3880ff",
            "line-width": 3,
            "line-opacity": 0.8,
          },
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
        });

        // Add circle layer for point geometries
        map.addLayer({
          id: `${layerId}-point`,
          type: "circle",
          source: layerId,
          filter: ["==", "$type", "Point"],
          paint: {
            "circle-color": "#3880ff",
            "circle-radius": 5,
            "circle-opacity": 0.8,
          },
        });

        console.log(`Successfully added OS API layers: ${layerId}`);
      } catch (error) {
        console.error("Error adding OS API layer:", error);
      }
    },
    []
  );

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

        // TODO: This is a hack to ensure annotations stay on top of the OS API layer
        // This is a temporary fix and will be removed in the future -  need to make it more robust!!
        const beforeLayerId = osApiLayerId || undefined;

        if (geomType.includes("linestring")) {
          console.log(`Creating line layer with color: ${style.color}`);
          map.addLayer(
            {
              id: annotation.id,
              type: "line",
              source: annotation.id,
              paint: {
                "line-color": style.color || "#3880ff",
                "line-opacity": style.opacity || 0.8,
                "line-width": style.width || 3,
              },
            },
            beforeLayerId
          );
        } else if (geomType.includes("point")) {
          console.log(`Creating point layer with color: ${style.color}`);
          map.addLayer(
            {
              id: annotation.id,
              type: "circle",
              source: annotation.id,
              paint: {
                "circle-color": style.color || "#3880ff",
                "circle-opacity": style.opacity || 0.8,
                "circle-radius": style.radius || 5,
              },
            },
            beforeLayerId
          );
        } else if (geomType.includes("polygon")) {
          console.log(`Creating polygon layer with color: ${style.color}`);
          map.addLayer(
            {
              id: annotation.id,
              type: "fill",
              source: annotation.id,
              paint: {
                "fill-color": style.color || "#3880ff",
                "fill-opacity": style.opacity || 0.5,
                "fill-outline-color": style.color || "#3880ff",
              },
            },
            beforeLayerId
          );
          console.log(`Polygon layer created with ID: ${annotation.id}`);
        } else {
          console.warn(`Unknown geometry type: ${geomType}`);
        }

        console.log(`FINISH addAnnotationLayer for ID: ${annotation.id}`);
      } catch (err) {
        console.error("Error in addAnnotationLayer:", err, annotation);
      }
    },
    [osApiLayerId]
  );

  // Set up the draw control
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
            "circle-radius": 4,
            "circle-color": "transparent",
            "circle-stroke-color": "#3880ff",
            "circle-stroke-width": 1,
            "circle-opacity": 0,
          },
        },
        // point - SELECTED
        {
          id: "gl-draw-point-select",
          type: "circle",
          filter: [
            "all",
            ["==", "$type", "Point"],
            ["==", "meta", "feature"],
            ["==", "active", "true"],
          ],
          paint: {
            "circle-radius": 6,
            "circle-color": "rgba(255, 255, 255, 0.5)",
            "circle-stroke-color": "#3880ff",
            "circle-stroke-width": 2,
          },
        },
      ],
    });

    map.addControl(draw);
    drawRef.current = draw;

    return () => {
      try {
        if (map && drawRef.current && map.getStyle()) {
          map.removeControl(drawRef.current);
          drawRef.current = null;
        }
      } catch (err) {
        console.warn("Error removing draw control during cleanup:", err);
      }
    };
  }, [mapRef, isMapReady]);

  // Load annotations from localStorage
  useEffect(() => {
    if (!mapRef?.current || !isMapReady || !drawRef.current) return;

    const map = mapRef.current;
    const draw = drawRef.current;

    try {
      const savedAnnotations = localStorage.getItem("mapAnnotations");
      if (savedAnnotations) {
        const parsed = JSON.parse(savedAnnotations);
        parsed.forEach((feature: GeoJSON.Feature) => {
          try {
            draw.add(feature);
            if (feature.id) {
              addAnnotationLayer(map, feature as Annotation);
            }
          } catch (err) {
            console.error("Error adding feature:", err, feature);
          }
        });
        setAnnotations(parsed);
      }
    } catch (error) {
      console.error("Error loading annotations:", error);
    }
  }, [mapRef, isMapReady, addAnnotationLayer]);

  // Load OS API data from localStorage
  // TODO: this will probably have to be moved to a different hook in the future?
  // Should be stored elswhere and not in localStorage
  useEffect(() => {
    if (!mapRef?.current || !isMapReady) return;

    const map = mapRef.current;

    try {
      const savedOsApiData = localStorage.getItem("osApiFeatures");
      if (savedOsApiData) {
        const parsed = JSON.parse(savedOsApiData);
        if (parsed.features && parsed.features.length > 0) {
          const geoJsonFeatures = parsed.features.map(
            (feature: GeoJSON.Feature) => ({
              ...feature,
              type: "Feature" as const,
            })
          ) as GeoJSON.Feature[];

          setOsApiFeatures(geoJsonFeatures);

          const layerId = "os-api-streets";
          setOsApiLayerId(layerId);
          addOSApiLayer(map, geoJsonFeatures, layerId);
        }
      }
    } catch (error) {
      console.error("Error loading OS API data:", error);
    }
  }, [mapRef, isMapReady, addOSApiLayer]);

  // Set up draw event handlers
  useEffect(() => {
    if (!mapRef?.current || !isMapReady || !drawRef.current) return;

    const map = mapRef.current;

    function updateAnnotations() {
      if (!drawRef.current) return;

      if (isBboxMode) {
        console.log("BBOX MODE - SKIPPING ANNOTATION UPDATES");
        return;
      }

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

        if (map && drawRef.current) {
          annotations.forEach((annotation) => {
            if (map.getSource(annotation.id)) {
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

    // Direct handler for immediate layer creation
    const handleDrawCreate = async (e: { features: GeoJSON.Feature[] }) => {
      console.log("Direct draw.create handler called with:", e);
      if (!e.features.length) return;

      for (const feature of e.features) {
        // Check if we're in bbox mode
        if (isBboxMode && feature.geometry?.type === "Polygon") {
          // Calculate and log bounding box
          const coordinates = feature.geometry.coordinates[0]; // Get outer ring

          let minLng = Infinity;
          let maxLng = -Infinity;
          let minLat = Infinity;
          let maxLat = -Infinity;

          coordinates.forEach(([lng, lat]) => {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          });

          const bbox = {
            west: minLng,
            south: minLat,
            east: maxLng,
            north: maxLat,
            width: maxLng - minLng,
            height: maxLat - minLat,
            center: {
              lng: (minLng + maxLng) / 2,
              lat: (minLat + maxLat) / 2,
            },
          };

          console.log("🔲 BOUNDING BOX CALCULATED:", bbox);
          console.log("📍 Polygon coordinates:", coordinates);

          try {
            console.log("🚀 Calling OS API with bbox...");

            const collectionId = "trn-ntwk-roadnode-1";

            const osData = await getCollectionFeaturesByBbox(
              collectionId,
              bbox
            );

            console.log("📊 OS API Data received:", {
              collectionId,
              numberReturned: osData.numberReturned,
              numberMatched: osData.numberMatched,
              featuresCount: osData.features?.length || 0,
              bbox: bbox,
            });

            if (osData.features && osData.features.length > 0) {
              console.log("🔍 First 3 features:", osData.features.slice(0, 3));
              console.log("📋 Full OS API response:", osData);

              const geoJsonFeatures = osData.features.map((feature) => ({
                ...feature,
                type: "Feature" as const,
              })) as GeoJSON.Feature[];

              setOsApiFeatures(geoJsonFeatures);
              localStorage.setItem(
                "osApiFeatures",
                JSON.stringify({
                  timestamp: Date.now(),
                  bbox: bbox,
                  collectionId: collectionId,
                  features: geoJsonFeatures,
                })
              );

              if (mapRef?.current) {
                const currentMap = mapRef.current;
                const layerId = "os-api-streets";
                setOsApiLayerId(layerId);
                addOSApiLayer(currentMap, geoJsonFeatures, layerId);
              }
            } else {
              console.log("⚠️ No features found in the bbox area");
            }
          } catch (error) {
            console.error("❌ Failed to fetch OS data:", error);
          }

          if (drawRef.current) {
            drawRef.current.deleteAll();
          }

          setIsBboxMode(false);

          if (onDrawComplete) {
            onDrawComplete();
          }

          // IMPORTANT: Return early to prevent normal annotation creation!!
          return;
        }

        // Normal annotation creation logic (only runs if NOT in bbox mode)
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

        const annotation: Annotation = {
          ...feature,
          id,
          properties: {
            ...feature.properties,
            style: defaultStyle,
          },
        };

        try {
          addAnnotationLayer(map, annotation);
          console.log(`Successfully created custom layer with ID: ${id}`);
        } catch (err) {
          console.error(`Error creating custom layer for new feature:`, err);
        }
      }

      if (!isBboxMode && onDrawComplete) {
        onDrawComplete();
      }
    };

    // Register event handlers
    map.on("draw.create", handleDrawCreate);
    map.on("draw.create", updateAnnotations);
    map.on("draw.update", updateAnnotations);
    map.on("draw.delete", updateAnnotations);
    map.on("draw.selectionchange", updateAnnotations);

    return () => {
      map.off("draw.create", handleDrawCreate);
      map.off("draw.create", updateAnnotations);
      map.off("draw.update", updateAnnotations);
      map.off("draw.delete", updateAnnotations);
      map.off("draw.selectionchange", updateAnnotations);
    };
  }, [
    mapRef,
    isMapReady,
    addAnnotationLayer,
    onDrawComplete,
    isBboxMode,
    addOSApiLayer,
  ]);

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

  // Handle keyboard delete of the selected annotation
  useEffect(() => {
    if (!mapRef?.current || !isMapReady) return;

    const mapContainer = mapRef.current.getContainer();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        deleteSelectedAnnotations();
      }
    };

    mapContainer.addEventListener("keydown", handleKeyDown);
    mapContainer.setAttribute("tabindex", "0");

    return () => {
      mapContainer.removeEventListener("keydown", handleKeyDown);
    };
  }, [mapRef, isMapReady, deleteSelectedAnnotations]);

  // Save annotations to localStorage
  useEffect(() => {
    if (annotations.length > 0) {
      localStorage.setItem("mapAnnotations", JSON.stringify(annotations));
    }
  }, [annotations]);

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

      const selectedIds = draw.getSelectedIds();

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

      // Set bbox mode flag
      setIsBboxMode(mode === "bbox");

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
          case "bbox":
            draw.changeMode("draw_polygon");
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
    [mapRef]
  );

  const clearOSApiLayer = useCallback(() => {
    if (!mapRef?.current || !osApiLayerId) return;

    const map = mapRef.current;

    try {
      if (map.getLayer(`${osApiLayerId}-line`)) {
        map.removeLayer(`${osApiLayerId}-line`);
      }
      if (map.getLayer(`${osApiLayerId}-point`)) {
        map.removeLayer(`${osApiLayerId}-point`);
      }
      if (map.getSource(osApiLayerId)) {
        map.removeSource(osApiLayerId);
      }

      setOsApiFeatures([]);
      setOsApiLayerId(null);
      localStorage.removeItem("osApiFeatures");

      console.log("OS API layer cleared");
    } catch (error) {
      console.error("Error clearing OS API layer:", error);
    }
  }, [mapRef, osApiLayerId]);

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
    // Add OS API related exports
    osApiFeatures,
    osApiLayerId,
    clearOSApiLayer,
    addOSApiLayer,
  };
}
