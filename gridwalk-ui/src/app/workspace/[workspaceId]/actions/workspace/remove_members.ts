"use server";
import { getAuthToken } from "../lib/auth";

interface RemoveWorkspaceMemberRequest {
  workspace_id: string;
  email: string;
}

export async function removeWorkspaceMember(
  data: RemoveWorkspaceMemberRequest,
): Promise<void> {
  const token = await getAuthToken();

  // Validation
  if (!data.workspace_id) throw new Error("Workspace ID is required");
  if (!data.email) throw new Error("Email is required");

  try {
    const response = await fetch(
      `${process.env.GRIDWALK_API}/workspace/${data.workspace_id}/members/${data.email}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspace_id: data.workspace_id,
          email: data.email,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) throw new Error("Authentication failed");
      throw new Error(errorText || "Failed to remove workspace member");
    }
  } catch (error) {
    console.error("Failed to remove workspace member:", error);
    throw error;
  }
}
