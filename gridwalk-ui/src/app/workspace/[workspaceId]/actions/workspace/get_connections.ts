"use server";
import { getAuthToken } from "../lib/auth";

export type WorkspaceConnection = {
  id: string;
  name: string;
  connector_type: string;
};

export async function getWorkspaceConnections(
  workspaceId: string
): Promise<WorkspaceConnection[]> {
  const token = await getAuthToken();

  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }

  try {
    const response = await fetch(
      `${process.env.GRIDWALK_API}/workspaces/${workspaceId}/connections`,
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
