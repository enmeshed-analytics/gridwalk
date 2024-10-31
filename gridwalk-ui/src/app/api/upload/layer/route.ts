// gridwalk-ui/src/app/api/upload/layer/route.ts
import { NextRequest } from "next/server";

const HARDCODED_AUTH_TOKEN = "VVPME0BYEDG7LJYGLL9PKJ8AS1GABM";

interface LayerInfo {
  workspace_id: string;
  name: string;
  file_type?: string;
}

interface FileConfig {
  maxSize: number;
  contentType: string;
  streamable: boolean;
  originalType?: string;
}

type FileConfigs = {
  readonly [key: string]: FileConfig;
};

const FILE_CONFIGS: FileConfigs = {
  ".geojson": {
    maxSize: 50 * 1024 * 1024,
    contentType: "application/geo+json",
    streamable: false,
  },
  ".json": {
    maxSize: 50 * 1024 * 1024,
    contentType: "application/json",
    streamable: false,
  },
  ".kml": {
    maxSize: 50 * 1024 * 1024,
    contentType: "application/vnd.google-earth.kml+xml",
    streamable: false,
  },
  ".shp": {
    maxSize: 100 * 1024 * 1024,
    contentType: "application/x-esri-shape",
    streamable: true,
  },
  ".gpkg": {
    maxSize: 500 * 1024 * 1024,
    contentType: "application/octet-stream",
    originalType: "application/geopackage+sqlite3",
    streamable: true,
  },
} as const;

async function prepareUploadFormData(
  file: File,
  workspaceId: string,
  layerName?: string,
): Promise<{ formData: FormData; contentType: string; originalType?: string }> {
  const extension = "." + file.name.split(".").pop()?.toLowerCase();
  const config = FILE_CONFIGS[extension];

  if (!config) {
    throw new Error(`Unsupported file type: ${extension}`);
  }

  const formData = new FormData();

  // Handle the file
  if (extension === ".gpkg") {
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], {
      type: "application/octet-stream",
    });
    formData.append("file", blob, file.name);
  } else {
    formData.append("file", file);
  }

  // Append layer info as a separate part
  const layerInfo: LayerInfo = {
    workspace_id: workspaceId,
    name: layerName ?? file.name,
    file_type: extension.substring(1),
  };

  // Important: Use proper JSON stringification
  formData.append("layer_info", JSON.stringify(layerInfo));

  // Log the form data contents for debugging
  console.log("Form data contents:", {
    layerInfo,
    fileName: file.name,
    fileSize: file.size,
  });

  return {
    formData,
    contentType: config.contentType,
    originalType: config.originalType,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const workspaceId = formData.get("workspace_id") as string | null;
    const layerName = formData.get("name") as string | null;

    if (!file || !workspaceId) {
      return Response.json(
        {
          success: false,
          error:
            `Missing required fields: ${!file ? "file" : ""} ${!workspaceId ? "workspace_id" : ""}`.trim(),
        },
        { status: 400 },
      );
    }

    console.log("Received upload request:", {
      fileName: file.name,
      fileSize: file.size,
      workspaceId,
      layerName,
    });

    const {
      formData: apiFormData,
      contentType,
      originalType,
    } = await prepareUploadFormData(file, workspaceId, layerName || undefined);

    const headers: HeadersInit = {
      Authorization: `Bearer ${HARDCODED_AUTH_TOKEN}`,
      Accept: "application/json",
      "X-File-Type": "." + file.name.split(".").pop()?.toLowerCase(),
      "X-Original-Content-Type": originalType || contentType,
      "X-Workspace-Id": workspaceId,
    };

    console.log("Sending request to backend:", {
      headers,
      formDataEntries: Array.from(apiFormData.entries()).map(([key]) => key),
    });

    const response = await fetch("http://localhost:3001/upload_layer", {
      method: "POST",
      headers,
      body: apiFormData,
    });

    const responseText = await response.text();
    console.log("Raw backend response:", responseText);

    if (!response.ok) {
      throw new Error(responseText || `Backend error: ${response.status}`);
    }

    const data = responseText ? JSON.parse(responseText) : null;
    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Upload error:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error during upload",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
