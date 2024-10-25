"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MapModal from "./components/mapModal/mapModal";
import { NavItem } from "./components/mapModal/types";
import MapEditNav from "./components/mapModal/mapEditModal";
import { MapEditItem } from "./components/mapModal/types";
import BaseLayerNav from "./components/mapModal/baseLayerModal";
import { BaseEditItem } from "./components/mapModal/types";

export interface TokenData {
  access_token: string;
  issued_at: number;
  expires_in: number;
}

const REFRESH_THRESHOLD = 30; // Refresh 30 seconds before expiry

// Token fetching and validation functions
const fetchToken = async () => {
  const response = await fetch("http://localhost:3001/os-token", { method: "GET" });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data: TokenData = await response.json();
  return data;
};

const isTokenExpired = (tokenData: TokenData) => {
  const currentTime = Math.floor(Date.now() / 1000);
  const expirationTime = tokenData.issued_at + tokenData.expires_in - REFRESH_THRESHOLD;
  return currentTime >= expirationTime;
};

export default function Project() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedItem, setSelectedItem] = useState<NavItem | null>(null);
  const [selectedEditItem, setSelectedEditItem] = useState<MapEditItem | null>(null);
  const [selectedBaseItem, setSelectedBaseItem] = useState<BaseEditItem | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Keep track of pending requests to prevent race conditions
  const pendingTokenRequest = useRef<Promise<TokenData> | null>(null);

  // Function to get a valid token, with built-in refresh if needed
  const getValidToken = useCallback(async (): Promise<TokenData> => {
    // If there's already a token request in progress, wait for it
    if (pendingTokenRequest.current) {
      return pendingTokenRequest.current;
    }

    // If we have a valid token, return it
    if (tokenData && !isTokenExpired(tokenData)) {
      return tokenData;
    }

    // Otherwise, fetch a new token
    try {
      pendingTokenRequest.current = fetchToken();
      const newTokenData = await pendingTokenRequest.current;
      setTokenData(newTokenData);
      return newTokenData;
    } finally {
      pendingTokenRequest.current = null;
    }
  }, [tokenData]);

  // Initial token fetch
  useEffect(() => {
    let isMounted = true;

    const initializeToken = async () => {
      try {
        setIsLoading(true);
        const data = await getValidToken();
        if (isMounted) {
          setTokenData(data);
        }
      } catch (error) {
        if (isMounted) {
          setMapError(error instanceof Error ? error.message : 'Failed to fetch token');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeToken();

    return () => {
      isMounted = false;
    };
  }, [getValidToken]);

  // Initialize map after token is available
  useEffect(() => {
    if (map.current || !mapContainer.current || !tokenData || isLoading) return;

    const initializeMap = async () => {
      try {
        const styleUrl = "http://localhost:3000/OS_VTS_3857_Light.json";
        const response = await fetch(styleUrl);
        const styleJson = await response.json();
        const currentToken = await getValidToken();

        const mapInstance = new maplibregl.Map({
          container: mapContainer.current!,
          style: styleJson,
          center: [-0.1278, 51.5074],
          zoom: 11,
          transformRequest: (url) => {
            if (url.startsWith("https://api.os.uk")) {
              try {
                // Get a fresh token for each request if needed
                return {
                  url: url,
                  headers: {
                    Authorization: `Bearer ${currentToken.access_token}`,
                  },
                };
              } catch (error) {
                console.error('Failed to refresh token during map request:', error);
                // Still return the request object to avoid breaking the map
                // The request will fail if the token is invalid
                return {
                  url: url,
                  headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                    "Content-Type": "application/json",
                  },
                };
              }
            } else if (url.startsWith(window.location.origin)) {
              console.log("same-origin");
              return {
                url: url,
                credentials: "same-origin" as const,
              };
            }
          }
        });

        mapInstance.addControl(new maplibregl.NavigationControl(), "top-right");
        map.current = mapInstance;

        mapInstance.on('load', () => {
          console.log('Map loaded successfully');
        });

      } catch (error) {
        console.error('Error initializing map:', error);
        setMapError(error instanceof Error ? error.message : 'Unknown error initializing map');
      }
    };

    initializeMap();

    return () => {
      map.current?.remove();
    };
  }, [tokenData, isLoading, getValidToken]);

  const handleNavItemClick = (item: NavItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleEditItemClick = (item: MapEditItem) => {
    setSelectedEditItem(item === selectedEditItem ? null : item);
  };

  const handleBaseItemClick = (item: BaseEditItem) => {
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

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-lg">Loading map...</div>
      </div>
    );
  }

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

      <MapEditNav
        onEditItemClick={handleEditItemClick}
        selectedEditItem={selectedEditItem}
      />

      <MapModal
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
      </MapModal>
      
      <BaseLayerNav
        onBaseItemClick={handleBaseItemClick}
        selectedBaseItem={selectedBaseItem}
      />
    </div>
  );
}
