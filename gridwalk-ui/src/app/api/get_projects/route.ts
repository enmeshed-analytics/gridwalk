import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const workspaceId = searchParams.get("workspace_id");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "Workspace ID is required" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${process.env.GRIDWALK_API}/projects?workspace_id=${workspaceId}`,
      {
        headers: {
          Authorization: `Bearer ${request.cookies.get("sid")?.value}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch projects");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 },
    );
  }
}
