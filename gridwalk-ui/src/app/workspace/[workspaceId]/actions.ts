"use server";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// CREATE PROJECTS
export type CreateProjectRequest = {
  name: string;
  workspace_id: string;
};

export type ProjectData = {
  id: string;
  name: string;
  workspace_id: string;
};

export async function createProject(
  data: CreateProjectRequest,
): Promise<ProjectData> {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid");

  if (!sid?.value) {
    throw new Error("Authentication token not found");
  }

  if (!data.workspace_id) {
    throw new Error("Workspace ID is required");
  }

  if (!data.name) {
    throw new Error("Project name is required");
  }

  const response = await fetch(`${process.env.GRIDWALK_API}/create_project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sid.value}`,
    },
    body: JSON.stringify({
      workspace_id: data.workspace_id,
      name: data.name.trim(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("Authentication failed");
    }
    throw new Error(errorText || "Failed to create project");
  }

  const projectData = await response.json();
  return projectData;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateProjectRequest;
    const project = await createProject(body);

    return NextResponse.json(
      {
        success: true,
        data: project,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Project creation error:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });

    if (error instanceof Error && error.message.includes("Authentication")) {
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
        error:
          error instanceof Error ? error.message : "Failed to create project",
      },
      { status: 400 },
    );
  }
}

// GET PROJECTS
export type ApiResponse = {
  status: string;
  data: string[];
  error: string | null;
};

export type ProjectsResponse = {
  success: boolean;
  data?: string[];
  error?: string;
};

export async function getProjectsServer(
  workspaceId: string,
): Promise<string[]> {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid");

  if (!sid?.value) {
    throw new Error("Authentication token not found");
  }

  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }

  const response = await fetch(
    `${process.env.GRIDWALK_API}/projects?workspace_id=${workspaceId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sid.value}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) {
      throw new Error("Authentication failed");
    }
    throw new Error(errorText || "Failed to fetch projects");
  }

  const projectsData = await response.json();

  if (!Array.isArray(projectsData.data)) {
    console.warn("Projects data is not an array:", projectsData.data);
    return [];
  }

  return projectsData.data;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspace_id");

    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          error: "Workspace ID is required",
        },
        { status: 400 },
      );
    }

    const projects = await getProjectsServer(workspaceId);

    return NextResponse.json(
      {
        success: true,
        data: projects,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("Project fetch error:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : "No stack trace",
    });

    if (error instanceof Error && error.message.includes("Authentication")) {
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
        error:
          error instanceof Error ? error.message : "Failed to fetch projects",
      },
      { status: 400 },
    );
  }
}
