import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const DEFAULT_WORKSPACE_ID = "426c93a3-fcca-42cb-b668-d6e3344d3dcf";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sid");

    if (!sessionId?.value) {
      throw new Error("Authentication token not found");
    }

    const body = (await request.json()) as { name: string };

    const response = await fetch("http://localhost:3001/create_project", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionId.value}`,
      },
      body: JSON.stringify({
        workspace_id: DEFAULT_WORKSPACE_ID,
        name: body.name.trim(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      if (response.status === 401) {
        throw new Error("Authentication failed");
      }
      throw new Error(errorData || "Project creation failed");
    }

    const projectData = await response.json();

    return NextResponse.json(
      {
        success: true,
        data: projectData,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Project creation error details:", {
      message: error.message,
      stack: error.stack,
    });

    if (error.message.includes("Authentication")) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication failed. Please log in again.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create project",
      },
      { status: 400 },
    );
  }
}
