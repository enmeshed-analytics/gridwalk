import { NextRequest } from "next/server";

// Hardcoded auth token - replace with your actual token
const HARDCODED_AUTH_TOKEN = "";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No file provided",
        }),
        { status: 400 },
      );
    }

    // Create a new FormData for the API call
    const apiFormData = new FormData();
    apiFormData.append("file", file);

    // Hardcoded values
    apiFormData.append("workspace_id", "");
    apiFormData.append("name", "my-awesome-layer");

    const response = await fetch("http://localhost:3001/upload_layer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HARDCODED_AUTH_TOKEN}`,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const data = await response.json();
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Upload failed",
      }),
      { status: 500 },
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
