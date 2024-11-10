import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const authToken = request.cookies.get("sid")?.value;
    if (!authToken) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Workspace name is required" },
        { status: 400 },
      );
    }

    const response = await fetch(`${process.env.GRIDWALK_API}/workspace`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create workspace: ${response.statusText}`);
    }

    return NextResponse.json({
      success: true,
      message: "Workspace created successfully",
    });
  } catch (error) {
    console.error("Error creating workspace:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create workspace",
      },
      { status: 500 },
    );
  }
}
