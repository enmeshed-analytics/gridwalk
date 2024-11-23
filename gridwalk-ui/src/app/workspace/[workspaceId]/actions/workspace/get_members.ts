"use server";

import { getAuthToken } from "../lib/auth";

type WorkspaceMember = {
  email: string;
  role: "Admin" | "Read";
};

export async function getWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const token = await getAuthToken();

  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }

  try {
    const response = await fetch(
      `${process.env.GRIDWALK_API}/workspace/${workspaceId}/members`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 401) {
        throw new Error("Unauthorized to view workspace members");
      }
      if (response.status === 404) {
        throw new Error("Workspace not found");
      }
      throw new Error(errorText || "Failed to fetch workspace members");
    }

    const members: WorkspaceMember[] = await response.json();

    return members;
  } catch (error) {
    console.error("Failed to fetch workspace members:", error);
    throw error;
  }
}
