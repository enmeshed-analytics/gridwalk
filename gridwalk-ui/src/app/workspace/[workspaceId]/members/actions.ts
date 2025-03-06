"use server";

import { revalidatePath } from "next/cache";
import { getAuthToken } from "@/app/utils";

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

export type AddWorkspaceMemberRequest = {
  workspace_id: string;
  email: string;
  role: "Admin" | "Read";
};

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
