"use server";

import { getAuthToken } from "../lib/auth";
import { AddWorkspaceMemberRequest } from "./types";
import { revalidatePath } from "next/cache";

export async function addWorkspaceMember(
  data: AddWorkspaceMemberRequest,
): Promise<void> {
  const token = await getAuthToken();

  // Validation
  if (!data.workspace_id) throw new Error("Workspace ID is required");
  if (!data.email) throw new Error("Email is required");
  if (!data.role) throw new Error("Role is required");

  try {
    const response = await fetch(
      `${process.env.GRIDWALK_API}/workspace/members`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspace_id: data.workspace_id,
          email: data.email.trim(),
          role: data.role,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) throw new Error("Authentication failed");
      throw new Error(errorText || "Failed to add workspace member");
    }

    // Revalidate the members list page/cache
    revalidatePath(`/workspaces/${data.workspace_id}/members`);
  } catch (error) {
    console.error("Failed to add workspace member:", error);
    throw error; // Re-throw to handle in the component
  }
}
