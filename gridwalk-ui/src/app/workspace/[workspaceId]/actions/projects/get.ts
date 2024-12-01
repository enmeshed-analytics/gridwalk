"use server";
import { getAuthToken } from "../lib/auth";

export interface Project {
  workspace_id: string;
  id: string;
  name: string;
  uploaded_by: string;
  created_at: number;
}

export async function getProjects(workspaceId: string): Promise<Project[]> {
  const token = await getAuthToken();
  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }
  try {
    const response = await fetch(
      `${process.env.GRIDWALK_API}/projects?workspace_id=${workspaceId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error("Authentication failed");
      }
      throw new Error(errorText || "Failed to fetch projects");
    }
    const projectsData: Project[] = await response.json();
    if (!Array.isArray(projectsData)) {
      console.warn("Projects data is not an array:", projectsData);
      return [];
    }
    return projectsData;
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    throw error;
  }
}
