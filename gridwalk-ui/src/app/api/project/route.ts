import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sid");

    if (!sessionId?.value) {
      throw new Error("Authentication token not found");
    }

    const body = (await request.json()) as {
      name: string;
      workspace_id: string;
    };

    // Validate required fields
    if (!body.workspace_id) {
      throw new Error("Workspace ID is required");
    }

    if (!body.name) {
      throw new Error("Project name is required");
    }

    const response = await fetch("http://localhost:3001/create_project", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionId.value}`,
      },
      body: JSON.stringify({
        workspace_id: body.workspace_id,
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
