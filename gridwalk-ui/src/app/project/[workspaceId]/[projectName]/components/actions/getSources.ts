"use server";

import { cookies } from "next/headers";

export async function getAuthToken() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid");

  if (!sid?.value) {
    throw new Error("Authentication token not found");
  }

  return sid.value;
}

export type Source = {
  name: string;
};

export type WorkspaceConnection = {
  id: string;
  layer: string;
  sources: Source[];
};

export async function getWorkspaceConnections(
  workspaceId: string
): Promise<WorkspaceConnection[]> {
  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }

  const token = await getAuthToken();

  if (!process.env.GRIDWALK_API) {
    throw new Error("GRIDWALK_API environment variable is not defined");
  }

  try {
    const response = await fetch(
      `${process.env.GRIDWALK_API}/workspaces/${workspaceId}/connections/primary/sources`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 401) {
        throw new Error("Unauthorized to view workspace connections");
      }

      if (response.status === 404) {
        throw new Error("Workspace not found");
      }

      throw new Error(errorText || "Failed to fetch workspace connections");
    }

    const connections: WorkspaceConnection[] = await response.json();
    return connections;
  } catch (error) {
    console.error("Failed to fetch workspace connections:", error);
    throw error;
  }
}
