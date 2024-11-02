import { NextRequest } from "next/server";
import { LayerInfo, FileConfigs, ChunkInfo } from "./types";

const DETAILS = "VVPME0BYEDG7LJYGLL9PKJ8AS1GABM";

const FILE_CONFIGS: FileConfigs = {
  ".geojson": {
    maxSize: 50 * 1024 * 1024,
    contentType: "application/geo+json",
  },
  ".json": {
    maxSize: 50 * 1024 * 1024,
    contentType: "application/json",
  },
  ".kml": {
    maxSize: 50 * 1024 * 1024,
    contentType: "application/vnd.google-earth.kml+xml",
  },
  ".shp": {
    maxSize: 100 * 1024 * 1024,
    contentType: "application/x-esri-shape",
  },
  ".gpkg": {
    maxSize: 500 * 1024 * 1024,
    contentType: "application/octet-stream",
    originalType: "application/geopackage+sqlite3",
  },
} as const;

async function prepareUploadFormData(
  file: File | Blob,
  workspaceId: string,
  layerName?: string,
  chunkInfo?: ChunkInfo,
): Promise<{ formData: FormData; contentType: string; originalType?: string }> {
  // Check that the file type is supported based on the file extension
  const fileName = (file as File).name || layerName!;
  const extension = "." + fileName.split(".").pop()?.toLowerCase();
  const config = FILE_CONFIGS[extension];
  if (!config) {
    throw new Error(`Unsupported file type: ${extension}`);
  }

  // Create new submission
  const formData = new FormData();

  // Handle the File element - with chunking awareness
  formData.append("file", file);

  // Append layer info as a separate part
  const layerInfo: LayerInfo = {
    workspace_id: workspaceId,
    name: layerName ?? fileName,
    file_type: extension.substring(1),
  };

  // Important: Use proper JSON stringification
  formData.append("layer_info", JSON.stringify(layerInfo));

  // If this is a chunked upload, add chunk metadata
  if (chunkInfo) {
    formData.append("chunk_info", JSON.stringify(chunkInfo));
  }

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
    const chunkInfoStr = formData.get("chunk_info") as string | null;

    // Check if a file and workspace id are there
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

    // Parse chunk info if present
    const chunkInfo = chunkInfoStr
      ? (JSON.parse(chunkInfoStr) as ChunkInfo)
      : undefined;

    console.log("Received upload request:", {
      fileName: file.name,
      fileSize: file.size,
      workspaceId,
      layerName,
      chunkInfo,
    });

    const {
      formData: apiFormData,
      contentType,
      originalType,
    } = await prepareUploadFormData(
      file,
      workspaceId,
      layerName || undefined,
      chunkInfo,
    );

    const headers: HeadersInit = {
      Authorization: `Bearer ${DETAILS}`,
      Accept: "application/json",
      "X-File-Type": "." + (file as File).name.split(".").pop()?.toLowerCase(),
      "X-Original-Content-Type": originalType || contentType,
      "X-Workspace-Id": workspaceId,
    };

    // Add chunk headers if this is a chunked upload
    if (chunkInfo) {
      headers["X-Chunk-Number"] = chunkInfo.currentChunk.toString();
      headers["X-Total-Chunks"] = chunkInfo.totalChunks.toString();
      headers["X-File-Size"] = chunkInfo.fileSize.toString();
    }

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
    console.log("Backend response:", responseText);

    if (!response.ok) {
      throw new Error(responseText || `Backend error: ${response.status}`);
    }

    const data = responseText ? JSON.parse(responseText) : null;
    return Response.json({
      success: true,
      data,
      chunkInfo,
    });
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
