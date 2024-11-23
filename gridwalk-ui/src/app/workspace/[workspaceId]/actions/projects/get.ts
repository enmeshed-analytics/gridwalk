"use server";

import { getAuthToken } from "../lib/auth";

export async function getProjects(workspaceId: string): Promise<string[]> {
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
        cache: "no-store", // DO WE NEED THIS?
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
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    throw error; // Re-throw to handle in the component
  }
}
