import React from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import proj4 from "proj4";
import {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  Position,
} from "geojson";

// Define CRS
export const britishNationalGrid =
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs";

export const wgs84 = "+proj=longlat +datum=WGS84 +no_defs";

// Interface for Map
export interface MapProps {
  activeFiles: string[];
  baseLayer: string;
}

// Interface for Ordnance Survey data
export interface TokenData {
  access_token: string;
  issued_at: number;
  expires_in: number;
}

// Extend the FeatureCollection type to include a CRS property
export interface FeatureCollectionWithCRS
  extends FeatureCollection<Geometry, GeoJsonProperties> {
  crs?: {
    type: string;
    properties: {
      name: string;
    };
  };
}

// Set the initial map view
export const INITIAL_VIEW_STATE = {
  latitude: 51.5074,
  longitude: -0.1278,
  zoom: 11,
};

// Refresh tokens
export const REFRESH_THRESHOLD = 60; // Refresh token 60 seconds before expiry

// Helper function for error handling
export const handleError = (
  setMapError: React.Dispatch<React.SetStateAction<string | null>>,
  error: Error,
  message: string,
) => {
  console.error(message, error);
  setMapError(`${message}: ${error.message}`);
};

// Fetch access token logic
export const fetchToken = async (
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
export const getValidToken = async (
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
export const transformGeoJsonData = (
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
