"use server";

import { getAuthToken } from "../lib/auth";
import { CreateProjectRequest, ProjectData } from "./types";
import { revalidatePath } from "next/cache";

export async function createProject(
  data: CreateProjectRequest,
): Promise<ProjectData> {
  const token = await getAuthToken();

  if (!data.workspace_id) throw new Error("Workspace ID is required");
  if (!data.name) throw new Error("Project name is required");

  const response = await fetch(`${process.env.GRIDWALK_API}/create_project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      workspace_id: data.workspace_id,
      name: data.name.trim(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) throw new Error("Authentication failed");
    throw new Error(errorText || "Failed to create project");
  }

  const projectData = await response.json();
  revalidatePath(`/workspaces/${data.workspace_id}/projects`);
  return projectData;
}
