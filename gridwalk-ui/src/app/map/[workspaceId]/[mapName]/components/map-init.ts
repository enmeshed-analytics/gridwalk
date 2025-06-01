"use client";
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapConfig, TokenData, UseMapInitResult } from "./types";

const REFRESH_THRESHOLD = 30;
const DEFAULT_CENTER: [number, number] = [-0.1278, 51.5074];
const DEFAULT_ZOOM = 11;
const MIN_ZOOM = 6;
const defaultStyleUrl = "/OS_VTS_3857_Light.json";

// Fetch api tokens in order to load OS maps
const getToken = (apiUrl: string): TokenData => {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", `${apiUrl}/os-token`, false);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send();
  if (xhr.status !== 200) {
    throw new Error(`HTTP error! status: ${xhr.status}`);
  }
  return JSON.parse(xhr.responseText);
};

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
  const [isMapReady, setIsMapReady] = useState(false);
  const tokenRef = useRef<TokenData | null>(null);

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
          pitch: config?.enable3D ? config?.pitch || 60 : 0,
          bearing: config?.enable3D ? config?.bearing || 0 : 0,
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
                  Accept: "application/x-protobuf",
                },
                credentials: "include",
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
          if (config?.enable3D) {
            enable3DBuildings(mapInstance);
          }
          setIsMapReady(true);
        });
      } catch (error) {
        console.error("Error initializing map:", error);
        setMapError(
          error instanceof Error
            ? error.message
            : "Unknown error initializing map"
        );
      }
    };

    initializeMap();

    return () => {
      if (map.current) {
        map.current.remove();
        setIsMapReady(false);
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
        map.current?.setStyle(styleJson, { diff: true });
      } catch (error) {
        console.error("Error updating map style:", error);
        setMapError(
          error instanceof Error
            ? error.message
            : "Unknown error updating map style"
        );
      }
    };

    updateMapStyle();
  }, [config?.styleUrl]);

  const enable3DBuildings = (mapInstance: maplibregl.Map) => {
    // Wait for the style to be fully loaded
    // Waiting for this type of event is really important for loading things in the right order at the right time
    if (!mapInstance.isStyleLoaded()) {
      mapInstance.once("style.load", () => enable3DBuildings(mapInstance));
      return;
    }

    try {
      const fillColor = mapInstance.getPaintProperty(
        "OS/TopographicArea_2/Building/1",
        "fill-color"
      );

      // Add 3D building layer
      if (!mapInstance.getLayer("OS/TopographicArea_2/Building/1_3D")) {
        mapInstance.addLayer({
          id: "OS/TopographicArea_2/Building/1_3D",
          type: "fill-extrusion",
          source: "esri",
          "source-layer": "TopographicArea_2",
          filter: ["==", "_symbol", 4],
          minzoom: 15,
          paint: {
            "fill-extrusion-color": (fillColor as string) || "#D6D6D6",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "RelHMax"],
            ],
            "fill-extrusion-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              16,
              0.9,
            ],
          },
        });

        // Set camera pitch and bearing for 3D effect
        mapInstance.setPitch(40);
        mapInstance.setBearing(0);
      }
    } catch (error) {
      console.error("Error enabling 3D buildings:", error);
    }
  };

  // Function to toggle 3D mode
  const toggle3DMode = (enable: boolean) => {
    if (!map.current) return;

    if (enable) {
      enable3DBuildings(map.current);
    } else {
      map.current.setPitch(0);
      map.current.setBearing(0);
      if (map.current.getLayer("OS/TopographicArea_2/Building/1_3D")) {
        map.current.removeLayer("OS/TopographicArea_2/Building/1_3D");
      }
    }
  };

  return { mapContainer, map, mapError, isMapReady, toggle3DMode };
};
