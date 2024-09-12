"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapProps {
  activeFiles: string[];
}

interface TokenData {
  access_token: string;
  issued_at: number;
  expires_in: number;
}

const INITIAL_VIEW_STATE = {
  latitude: 51.5074,
  longitude: -0.1278,
  zoom: 11,
};

const REFRESH_THRESHOLD = 60; // Refresh token 60 seconds before expiry

const Map: React.FC<MapProps> = ({ activeFiles }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const tokenDataRef = useRef<TokenData | null>(null);
  const tokenPromiseRef = useRef<Promise<string | null> | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      const response = await fetch("/api/os-map-auth", { method: "POST" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: TokenData = await response.json();
      tokenDataRef.current = data;
      return data.access_token;
    } catch (error) {
      console.error("Error fetching token:", error);
      setMapError(
        `Error fetching access token: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }, []);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (tokenPromiseRef.current) {
      return tokenPromiseRef.current;
    }

    if (!tokenDataRef.current) {
      tokenPromiseRef.current = fetchToken();
      const token = await tokenPromiseRef.current;
      tokenPromiseRef.current = null;
      return token;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = tokenDataRef.current.issued_at + tokenDataRef.current.expires_in;

    if (currentTime >= expirationTime - REFRESH_THRESHOLD) {
      tokenPromiseRef.current = fetchToken();
      const token = await tokenPromiseRef.current;
      tokenPromiseRef.current = null;
      return token;
    }

    return tokenDataRef.current.access_token;
  }, [fetchToken]);

  const transformRequest = useCallback(
    (url: string) => {
      if (url.startsWith("https://api.os.uk")) {
        return {
          url: url,
          headers: {
            Authorization: `Bearer ${tokenDataRef.current?.access_token || ""}`,
            "Content-Type": "application/json",
          },
        };
      }
    },
    []
  );

  // Set up token refresh interval
  useEffect(() => {
    const refreshToken = async () => {
      await getValidToken();
    };

    refreshToken(); // Initial token fetch
    const refreshInterval = setInterval(refreshToken, 4 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [getValidToken]);

  const initMap = useCallback(async () => {
    if (!mapContainer.current) return;

    try {
      await getValidToken(); // Ensure we have a valid token before initializing the map

      const styleUrl = `${window.location.origin}/OS_VTS_3857_Light.json`

      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: styleUrl,
        center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
        zoom: INITIAL_VIEW_STATE.zoom,
        minZoom: 6,
        maxBounds: [
          [-10.7, 49.5], // Southwest coordinates
          [1.9, 61.0] // Northeast coordinates
        ],
        transformRequest: transformRequest,
      });

      map.current.on("load", () => {
        setMapLoaded(true);
      });

      map.current.on("error", (e) => {
        console.error("Map error:", e);
      });
    } catch (error) {
      console.error("Error initializing map:", error);
      setMapError(
        `Error initializing map: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [getValidToken, transformRequest]);

  // Initialize map
  useEffect(() => {
    initMap();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [initMap]);

  // Set up token refresh interval
  useEffect(() => {
    const refreshInterval = setInterval(
      async () => {
        await getValidToken();
      },
      (REFRESH_THRESHOLD * 1000) / 2,
    );

    return () => clearInterval(refreshInterval);
  }, [getValidToken]);

  // Handle active files
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    // Remove layers and sources for files that are no longer active
    map.current.getStyle().layers.forEach((layer) => {
      if (
        layer.id.startsWith("geojson-layer-") &&
        !activeFiles.includes(layer.id.replace("geojson-layer-", ""))
      ) {
        map.current?.removeLayer(layer.id);
        map.current?.removeSource(layer.id.replace("layer", "source"));
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
