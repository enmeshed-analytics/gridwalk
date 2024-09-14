"use client";
import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import proj4 from "proj4";
import {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  Position,
} from "geojson";

// Define CRS
const britishNationalGrid =
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs";
const wgs84 = "+proj=longlat +datum=WGS84 +no_defs";

// Interface for Map
interface MapProps {
  activeFiles: string[];
  baseLayer: string;
}

// Interface for Ordnance Survey data
interface TokenData {
  access_token: string;
  issued_at: number;
  expires_in: number;
}

// Extend the FeatureCollection type to include a CRS property
interface FeatureCollectionWithCRS
  extends FeatureCollection<Geometry, GeoJsonProperties> {
  crs?: {
    type: string;
    properties: {
      name: string;
    };
  };
}

// Set the initial map view
const INITIAL_VIEW_STATE = {
  latitude: 51.5074,
  longitude: -0.1278,
  zoom: 11,
};

// Refresh tokens
const REFRESH_THRESHOLD = 60; // Refresh token 60 seconds before expiry

// Helper function for error handling
const handleError = (
  setMapError: React.Dispatch<React.SetStateAction<string | null>>,
  error: Error,
  message: string,
) => {
  console.error(message, error);
  setMapError(`${message}: ${error.message}`);
};

// Fetch access token logic
const fetchToken = async (
  setMapError: React.Dispatch<React.SetStateAction<string | null>>,
  tokenDataRef: React.MutableRefObject<TokenData | null>,
) => {
  try {
    const response = await fetch("/api/os-map-auth", { method: "POST" });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data: TokenData = await response.json();
    tokenDataRef.current = data;
    return data.access_token;
  } catch (error) {
    handleError(setMapError, error as Error, "Error fetching token");
    return null;
  }
};

// Retrieve a valid token or refresh if necessary
const getValidToken = async (
  fetchToken: (
    setMapError: React.Dispatch<React.SetStateAction<string | null>>,
    tokenDataRef: React.MutableRefObject<TokenData | null>,
  ) => Promise<string | null>,
  tokenDataRef: React.MutableRefObject<TokenData | null>,
  tokenPromiseRef: React.MutableRefObject<Promise<string | null> | null>,
  setMapError: React.Dispatch<React.SetStateAction<string | null>>,
): Promise<string | null> => {
  if (tokenPromiseRef.current) return tokenPromiseRef.current;

  if (!tokenDataRef.current) {
    tokenPromiseRef.current = fetchToken(setMapError, tokenDataRef);
    const token = await tokenPromiseRef.current;
    tokenPromiseRef.current = null;
    return token;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const expirationTime =
    tokenDataRef.current.issued_at + tokenDataRef.current.expires_in;

  if (currentTime >= expirationTime - REFRESH_THRESHOLD) {
    tokenPromiseRef.current = fetchToken(setMapError, tokenDataRef);
    const token = await tokenPromiseRef.current;
    tokenPromiseRef.current = null;
    return token;
  }

  return tokenDataRef.current.access_token;
};

// Function to transform GeoJSON data to WGS84 (EPSG:4326)
const transformGeoJsonData = (
  geojsonData: FeatureCollectionWithCRS,
): FeatureCollectionWithCRS => {
  console.log("Input CRS:", JSON.stringify(geojsonData.crs, null, 2));

  const transformedData: FeatureCollectionWithCRS = { ...geojsonData };

  // Check if the input is already in WGS84
  if (
    geojsonData.crs?.properties.name === "urn:ogc:def:crs:OGC:1.3:CRS84" ||
    geojsonData.crs?.properties.name.includes("EPSG:4326")
  ) {
    console.log("Data already in WGS84, no transformation needed");
    return geojsonData;
  }

  // Assuming British National Grid if not WGS84
  console.log("Transforming from British National Grid to WGS84");

  transformedData.features = geojsonData.features.map((feature) => {
    const transformedFeature = { ...feature };

    if (feature.geometry.type === "Point") {
      transformedFeature.geometry = {
        ...feature.geometry,
        coordinates: proj4(
          britishNationalGrid,
          wgs84,
          feature.geometry.coordinates as Position,
        ) as Position,
      };
    } else if (feature.geometry.type === "Polygon") {
      transformedFeature.geometry = {
        ...feature.geometry,
        coordinates: (feature.geometry.coordinates as Position[][]).map(
          (ring) =>
            ring.map(
              (coord) => proj4(britishNationalGrid, wgs84, coord) as Position,
            ),
        ),
      };
    } else if (feature.geometry.type === "MultiPolygon") {
      transformedFeature.geometry = {
        ...feature.geometry,
        coordinates: (feature.geometry.coordinates as Position[][][]).map(
          (polygon) =>
            polygon.map((ring) =>
              ring.map(
                (coord) => proj4(britishNationalGrid, wgs84, coord) as Position,
              ),
            ),
        ),
      };
    }

    return transformedFeature;
  });

  // Update the CRS property to WGS84
  transformedData.crs = {
    type: "name",
    properties: {
      name: "urn:ogc:def:crs:OGC:1.3:CRS84",
    },
  };

  console.log("Transformation complete");
  return transformedData;
};

// Initialize the map
const initMap = async (
  mapContainer: React.RefObject<HTMLDivElement>,
  baseLayer: string,
  setMapLoaded: React.Dispatch<React.SetStateAction<boolean>>,
  getValidToken: () => Promise<string | null>,
  setMapError: React.Dispatch<React.SetStateAction<string | null>>,
  map: React.MutableRefObject<maplibregl.Map | null>,
  tokenDataRef: React.MutableRefObject<TokenData | null>,
) => {
  if (!mapContainer.current) return;

  try {
    await getValidToken();

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: baseLayer,
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom,
      minZoom: 6,
      maxBounds: [
        [-10.7, 49.5], // Southwest coordinates
        [1.9, 61.0], // Northeast coordinates
      ],
      transformRequest: (url) => {
        if (url.startsWith("https://api.os.uk")) {
          return {
            url: url,
            headers: {
              Authorization: `Bearer ${tokenDataRef.current?.access_token || ""}`,
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

    map.current.on("load", () => setMapLoaded(true));
    map.current.on("styledata", () =>
      console.log("New style loaded:", baseLayer),
    );

    map.current.on("error", (e) =>
      handleError(setMapError, e.error, "Map error"),
    );
  } catch (error) {
    handleError(setMapError, error as Error, "Error initializing map");
  }
};

// MAIN MAP COMPONENT
const Map: React.FC<MapProps> = ({ activeFiles, baseLayer }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const tokenDataRef = useRef<TokenData | null>(null);
  const tokenPromiseRef = useRef<Promise<string | null> | null>(null);

  // Initialize map on component mount
  useEffect(() => {
    initMap(
      mapContainer,
      baseLayer,
      setMapLoaded,
      () =>
        getValidToken(fetchToken, tokenDataRef, tokenPromiseRef, setMapError),
      setMapError,
      map,
      tokenDataRef,
    );

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [baseLayer]);

  // Adds locally uploaded Geojsons to the map
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove layers for files that are no longer active
    map.current.getStyle().layers.forEach((layer) => {
      if (
        layer.id.startsWith("geojson-layer-") &&
        !activeFiles.includes(layer.id.replace("geojson-layer-", ""))
      ) {
        map.current?.removeLayer(layer.id);
        map.current?.removeSource(layer.id.replace("layer", "source"));
      }
    });

    activeFiles.forEach((fileName) => {
      if (!map.current?.getSource(`geojson-source-${fileName}`)) {
        const geojsonData = localStorage.getItem(`file:${fileName}`);

        if (geojsonData) {
          try {
            const parsedData = JSON.parse(
              geojsonData,
            ) as FeatureCollectionWithCRS;
            const transformedData = transformGeoJsonData(parsedData);

            console.log(
              "First feature coordinates after transformation:",
              transformedData.features[0].geometry,
            );

            map.current?.addSource(`geojson-source-${fileName}`, {
              type: "geojson",
              data: transformedData,
            });

            map.current?.addLayer({
              id: `geojson-layer-${fileName}`,
              type: "fill",
              source: `geojson-source-${fileName}`,
              paint: {
                "fill-color": "#FF0000",
                "fill-opacity": 0.5,
                "fill-outline-color": "#00FF00",
              },
            });
          } catch (error) {
            console.error(
              `Error processing GeoJSON data for file ${fileName}:`,
              error,
            );
          }
        } else {
          console.error(`No data found in localStorage for file: ${fileName}`);
        }
      }
    });
  }, [activeFiles, mapLoaded]);

  // Return the map container and error message if any
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
