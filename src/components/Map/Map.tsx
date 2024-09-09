'use client'
import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapProps {
  activeFiles: string[];
}

const INITIAL_VIEW_STATE = {
  latitude: 51.5074,
  longitude: -0.1278,
  zoom: 11,
};

const Map: React.FC<MapProps> = ({ activeFiles }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            "gridwalk-osm-tiles": {
              type: "vector",
              tiles: [
                `${window.location.origin}/api/tiles/{z}/{x}/{y}?layers=roads`,
              ],
              minzoom: 0,
              maxzoom: 20,
            },
          },
          layers: [
            {
              id: "mvt-layer-roads",
              type: "line",
              source: "gridwalk-osm-tiles",
              "source-layer": "roads",
              paint: {},
            },
          ],
        },
        center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
        zoom: INITIAL_VIEW_STATE.zoom,
      });

      map.current.on('load', () => {
        setMapLoaded(true);
      });

      map.current.on("error", (e) => {
        console.error("Map error:", e);
      });

    } catch (error) {
      console.error("Error initializing map:", error);
      setMapError(
        `Error initializing map: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only once

  // Handle active files
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove layers and sources for files that are no longer active
    map.current.getStyle().layers.forEach((layer) => {
      if (layer.id.startsWith('geojson-layer-') && !activeFiles.includes(layer.id.replace('geojson-layer-', ''))) {
        map.current?.removeLayer(layer.id);
        map.current?.removeSource(layer.id.replace('layer', 'source'));
      }
    });

    // Add new sources and layers for active files
    activeFiles.forEach((fileName) => {
      if (!map.current?.getSource(`geojson-source-${fileName}`)) {
        const geojsonData = localStorage.getItem(`file:${fileName}`);
        if (geojsonData) {
          map.current?.addSource(`geojson-source-${fileName}`, {
            type: "geojson",
            data: JSON.parse(geojsonData),
          });

          map.current?.addLayer({
            id: `geojson-layer-${fileName}`,
            type: "fill",
            source: `geojson-source-${fileName}`,
            paint: {
              "fill-color": "#888888",
              "fill-opacity": 0.5,
              "fill-outline-color": "rgba(0, 255, 0, 1)",
            },
          });
        }
      }
    });
  }, [activeFiles, mapLoaded]);

  return (
    <>
      <div
        ref={mapContainer}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-75">
          <p className="text-red-700 font-bold">{mapError}</p>
        </div>
      )}
    </>
  );
};

export default React.memo(Map);
