import { NextRequest } from "next/server";

const HARDCODED_AUTH_TOKEN = "VVPME0BYEDG7LJYGLL9PKJ8AS1GABM";

interface LayerInfo {
  workspace_id: string;
  name: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Validation step
    const file = formData.get("file");
    const workspaceId = formData.get("workspace_id");
    const layerName = formData.get("name");

    // Early validation return
    if (!file || !(file instanceof File)) {
      return Response.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }

    if (!workspaceId || !layerName) {
      return Response.json(
        { success: false, error: "Missing workspace_id or name" },
        { status: 400 },
      );
    }

    // Transform for Rust backend
    const layerInfo: LayerInfo = {
      workspace_id: workspaceId.toString(),
      name: layerName.toString(),
    };

    const apiFormData = new FormData();
    apiFormData.append("file", file);
    apiFormData.append(
      "layer_info",
      new Blob([JSON.stringify(layerInfo)], { type: "application/json" }),
    );

    // Send to backend
    const response = await fetch("http://localhost:3001/upload_layer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HARDCODED_AUTH_TOKEN}`,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.statusText);
    }

    console.log("SUCCESS");

    const data = await response.json();
    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 },
    );
  }
}
