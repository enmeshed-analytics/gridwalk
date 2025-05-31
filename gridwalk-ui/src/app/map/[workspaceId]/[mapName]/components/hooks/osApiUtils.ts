interface OSAPIResponse {
  type: string;
  features: Array<{
    type: string;
    geometry: GeoJSON.Geometry;
    properties: Record<string, unknown>;
    id?: string;
  }>;
  links?: Array<{
    href: string;
    rel: string;
    type?: string;
  }>;
  numberReturned?: number;
  numberMatched?: number;
}

interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
  width: number;
  height: number;
  center: {
    lng: number;
    lat: number;
  };
}

function formatBboxForAPI(bbox: BoundingBox): string {
  return `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
}

function getOSApiKey(): string {
  const apiKey =
    process.env.NEXT_PUBLIC_OS_API_KEY || process.env.OS_PROJECT_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OS API key not found in environment variables. Please set NEXT_PUBLIC_OS_API_KEY or OS_PROJECT_API_KEY"
    );
  }

  return apiKey;
}

export async function getSingleCollectionFeature(
  collectionId: string,
  options: {
    featureId?: string;
    queryAttr?: "usrn" | "toid";
    queryAttrValue?: string;
    bbox?: BoundingBox;
  } = {}
): Promise<OSAPIResponse> {
  const { featureId, queryAttr, queryAttrValue, bbox } = options;

  // Base endpoints
  const NGD_FEATURES_BASE_PATH = "https://api.os.uk/features/ngd/ofa/v1";

  let endpoint: string;
  if (featureId) {
    endpoint = `${NGD_FEATURES_BASE_PATH}/collections/${collectionId}/items/${featureId}`;
  } else {
    endpoint = `${NGD_FEATURES_BASE_PATH}/collections/${collectionId}/items`;
  }

  try {
    const apiKey = getOSApiKey();

    const queryParams: Record<string, string> = {};

    queryParams["key"] = apiKey;

    if (bbox) {
      queryParams["bbox"] = formatBboxForAPI(bbox);
    }

    if (queryAttr && queryAttrValue) {
      queryParams["filter"] = `${queryAttr}=${queryAttrValue}`;
    }

    // limit the number of features returned to 75
    // OS limit is 100 anyway
    queryParams["limit"] = "75";

    const urlParams = new URLSearchParams(queryParams);
    endpoint = `${endpoint}?${urlParams.toString()}`;

    console.log("🌐 Making OS API request");

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error Response:", errorText);
      throw new Error(
        `OS API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data: OSAPIResponse = await response.json();

    console.log("✅ OS API Response:", {
      numberReturned: data.numberReturned,
      numberMatched: data.numberMatched,
      featuresCount: data.features?.length || 0,
    });

    return data;
  } catch (error) {
    console.error("❌ Error calling OS API:", error);
    throw error;
  }
}

export async function getCollectionFeaturesByBbox(
  collectionId: string,
  bbox: BoundingBox
): Promise<OSAPIResponse> {
  return getSingleCollectionFeature(collectionId, {
    bbox,
  });
}
