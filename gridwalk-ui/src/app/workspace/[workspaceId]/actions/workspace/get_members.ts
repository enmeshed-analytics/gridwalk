"use server";
import { getAuthToken } from "../lib/auth";
import { revalidatePath } from "next/cache";

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
      `${process.env.GRIDWALK_API}/workspace/getmem`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
        }),
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

    // Revalidate the members list page/cache
    revalidatePath(`/workspaces/${workspaceId}/members`);

    return members;
  } catch (error) {
    console.error("Failed to fetch workspace members:", error);
    throw error;
  }
}
