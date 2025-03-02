"use server";
import { getAuthToken } from "@/app/utils";
import { revalidatePath } from "next/cache";

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const token = await getAuthToken();
  if (!workspaceId) throw new Error("Workspace ID is required");

  const response = await fetch(
    `${process.env.GRIDWALK_API}/workspace/${workspaceId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) throw new Error("Authentication failed");
    if (response.status === 403) throw new Error("Insufficient permissions");
    if (response.status === 404) throw new Error("Workspace not found");
    throw new Error(errorText || "Failed to delete workspace");
  }

  // Revalidate the projects list page to reflect the deletion
  revalidatePath(`/workspaces`);
}
