'use client'
import { useEffect, useRef, useState } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

// Constants
const REFRESH_THRESHOLD = 30;
const DEFAULT_CENTER: [number, number] = [-0.1278, 51.5074];
const DEFAULT_ZOOM = 11;
const MIN_ZOOM = 6;
const defaultStyleUrl = "/OS_VTS_3857_Light.json";

// Interfaces
export interface TokenData {
  access_token: string;
  issued_at: number;
  expires_in: number;
}

export interface MapConfig {
  center?: [number, number];
  zoom?: number;
  styleUrl?: string;
  apiUrl: string
}

export interface UseMapInitResult {
  mapContainer: React.RefObject<HTMLDivElement>;
  map: React.RefObject<maplibregl.Map | null>;
  mapError: string | null;
}

// Fetch api tokens in order to load OS maps
const getToken = (apiUrl: string): TokenData => {
  const xhr = new XMLHttpRequest()
  xhr.open("GET", `${apiUrl}/os-token`, false)
  xhr.setRequestHeader("Content-Type", "application/json")
  xhr.send()
  if (xhr.status !== 200) {
    throw new Error(`HTTP error! status: ${xhr.status}`)
  }
  return JSON.parse(xhr.responseText)
}

const isTokenValid = (tokenData: TokenData | null): boolean => {
  if (!tokenData) return false;
  const currentTime = Date.now();
  const issuedAt = Number(tokenData.issued_at);
  const expiresIn = Number(tokenData.expires_in) * 1000;
  const expirationTime = issuedAt + expiresIn - REFRESH_THRESHOLD * 1000;
  return currentTime < expirationTime;
};

export const useMapInit = (config: MapConfig): UseMapInitResult => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const tokenRef = useRef<TokenData | null>(null);

  // Initial map setup
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const initializeMap = async () => {
      try {
        const styleUrl =
          typeof config?.styleUrl === "string"
            ? config.styleUrl
            : defaultStyleUrl;
        const response = await fetch(styleUrl);
        if (!response.ok) {
          throw new Error(`Failed to load style: ${response.status}`);
        }
        const styleJson = await response.json();

        const mapInstance = new maplibregl.Map({
          container: mapContainer.current!,
          style: styleJson,
          center: config?.center ?? DEFAULT_CENTER,
          zoom: config?.zoom ?? DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxBounds: [
            [-10.7, 49.5],
            [1.9, 61.0],
          ],
          transformRequest: (url) => {
            if (url.startsWith("https://api.os.uk")) {
              if (!isTokenValid(tokenRef.current)) {
                try {
                  tokenRef.current = getToken(config.apiUrl);
                } catch (error) {
                  console.error("Failed to fetch token:", error);
                  return {
                    url: url,
                    headers: {},
                  };
                }
              }
              return {
                url: url,
                headers: {
                  Authorization: `Bearer ${tokenRef.current?.access_token}`,
                  "Content-Type": "application/json",
                },
              };
            } else if (url.includes("http://localhost:3001")) {
              return {
                url: url,
                headers: {
                  'Accept': 'application/x-protobuf'
                },
                credentials: 'include'
              };
            } else if (url.startsWith(window.location.origin)) {
              return {
                url: url,
                credentials: "same-origin" as const,
              };
            }
          },
        });

        mapInstance.addControl(new maplibregl.NavigationControl(), "top-right");
        map.current = mapInstance;

        mapInstance.on("load", () => {
          console.log("Map loaded successfully");

           // Configure the map with vector tiles
           mapInstance.addSource("local-tiles", {
             type: "vector",
             tiles: [
               "http://localhost:3001/workspaces/f57e7ba0-a30f-47bd-b641-11d5e25b9978/connections/primary/sources/london/tiles/{z}/{x}/{y}"
             ],
             minzoom: 0,
             maxzoom: 14,
           });


           // Add a layer for each vector tile layer you want to display
           // You'll need to know the source layer names from your vector tiles
           mapInstance.addLayer({
             id: "local-tile-layer",
             type: "fill",  // or "line", "symbol", etc. depending on your data
             source: "local-tiles",
             "source-layer": "london",  // Replace with actual source layer name
             paint: {
               "fill-color": "#888888",
               "fill-opacity": 0.8
             }
           });


          });
      } catch (error) {
        console.error("Error initializing map:", error);
        setMapError(
          error instanceof Error
            ? error.message
            : "Unknown error initializing map",
        );
      }
    };

    initializeMap();

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
      // eslint-disable-next-line
  }, [config?.center, config?.zoom]);

  // Handle style changes - changing between different basemaps
  useEffect(() => {
    if (!map.current || typeof config?.styleUrl !== "string") return;

    const updateMapStyle = async () => {
      try {
        const response = await fetch(config.styleUrl as string);
        if (!response.ok) {
          throw new Error(`Failed to load style: ${response.status}`);
        }
        const styleJson = await response.json();
        map.current?.setStyle(styleJson);
      } catch (error) {
        console.error("Error updating map style:", error);
        setMapError(
          error instanceof Error
            ? error.message
            : "Unknown error updating map style",
        );
      }
    };

    updateMapStyle();
  }, [config?.styleUrl]);

  return { mapContainer, map, mapError };
};
