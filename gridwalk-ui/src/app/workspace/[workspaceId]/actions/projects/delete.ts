"use server";
import { getAuthToken } from "../lib/auth";
import { revalidatePath } from "next/cache";

export async function deleteProject(
  workspaceId: string,
  projectId: string,
): Promise<void> {
  const token = await getAuthToken();
  if (!workspaceId) throw new Error("Workspace ID is required");
  if (!projectId) throw new Error("Project ID is required");

  const response = await fetch(
    `${process.env.GRIDWALK_API}/projects?workspace_id=${workspaceId}&project_id=${projectId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) throw new Error("Authentication failed");
    if (response.status === 403) throw new Error("Insufficient permissions");
    if (response.status === 404)
      throw new Error("Project or workspace not found");
    throw new Error(errorText || "Failed to delete project");
  }

  // Revalidate the projects list page to reflect the deletion
  revalidatePath(`/workspaces/${workspaceId}/projects`);
}
