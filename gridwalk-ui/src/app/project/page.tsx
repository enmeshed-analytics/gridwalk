"use client";
import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MainMapNavigation from "./components/navBars/mainMapNavigation";
import { MainMapNav } from "./components/navBars/types";
import MapEditNavigation from "./components/navBars/mapEditNavigation";
import { MapEditNav } from "./components/navBars/types";
import BaseLayerNavigation from "./components/navBars/baseLayerNavigation";
import { BaseEditNav } from "./components/navBars/types";

export interface TokenData {
  access_token: string;
  issued_at: number;
  expires_in: number;
}

const REFRESH_THRESHOLD = 30; // Refresh 30 seconds before expiry

// Synchronous token fetching
const getToken = (): TokenData => {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "http://localhost:3001/os-token", false); // false makes the request synchronous
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

export default function Project() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedItem, setSelectedItem] = useState<MainMapNav | null>(null);
  const [selectedEditItem, setSelectedEditItem] = useState<MapEditNav | null>(
    null,
  );
  const [selectedBaseItem, setSelectedBaseItem] = useState<BaseEditNav | null>(
    null,
  );
  const [mapError, setMapError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const tokenRef = useRef<TokenData | null>(null);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const initializeMap = async () => {
      try {
        const styleUrl = "http://localhost:3000/OS_VTS_3857_Light.json";
        const response = await fetch(styleUrl);
        if (!response.ok) {
          throw new Error(`Failed to load style: ${response.status}`);
        }
        const styleJson = await response.json();

        const mapInstance = new maplibregl.Map({
          container: mapContainer.current!,
          style: styleJson,
          center: [-0.1278, 51.5074],
          zoom: 11,
          transformRequest: (url) => {
            if (url.startsWith("https://api.os.uk")) {
              // Check if we need a new token
              if (!isTokenValid(tokenRef.current)) {
                try {
                  tokenRef.current = getToken();
                } catch (error) {
                  console.error("Failed to fetch token:", error);
                  return {
                    url: url,
                    headers: {}, // Return empty headers if token fetch fails
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
      map.current?.remove();
    };
  }, []);

  const handleNavItemClick = (item: MainMapNav) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleEditItemClick = (item: MapEditNav) => {
    setSelectedEditItem(item === selectedEditItem ? null : item);
  };

  const handleBaseItemClick = (item: BaseEditNav) => {
    setSelectedBaseItem(item);
    switch (item.id) {
      case "light":
        // Set light blue style
        break;
      case "dark":
        // Set dark blue style
        break;
      case "car":
        // Set purple style
        break;
    }
  };

  return (
    <div className="w-full h-screen relative">
      {mapError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg">
          {mapError}
        </div>
      )}
      <div className="absolute inset-0 pl-10">
        <div ref={mapContainer} className="h-full w-full" />
      </div>

      <MapEditNavigation
        onEditItemClick={handleEditItemClick}
        selectedEditItem={selectedEditItem}
      />

      <MainMapNavigation
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedItem(null);
        }}
        onNavItemClick={handleNavItemClick}
        selectedItem={selectedItem}
      >
        {selectedItem && (
          <div>
            <h2 className="text-xl font-bold mb-4">{selectedItem.title}</h2>
            <p className="text-gray-600">{selectedItem.description}</p>
          </div>
        )}
      </MainMapNavigation>

      <BaseLayerNavigation
        onBaseItemClick={handleBaseItemClick}
        selectedBaseItem={selectedBaseItem}
      />
    </div>
  );
}
