"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthToken } from "@/app/utils";

// Define profile data to be returned
export type ProfileData = {
  first_name: string;
  last_name: string;
  email: string;
};

// Fetch profile data
export async function getProfile(): Promise<ProfileData> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("sid");

    if (!sessionCookie?.value) {
      throw new Error("No session cookie found");
    }

    const response = await fetch(`${process.env.GRIDWALK_API}/profile`, {
      headers: {
        Authorization: `Bearer ${sessionCookie.value}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch profile");
    }

    const data = await response.json();
    return {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
    };
  } catch (error) {
    console.error("Error fetching profile:", error);
    return {
      first_name: "",
      last_name: "",
      email: "",
    };
  }
}

// create workspace action
export async function createWorkspace(name: string) {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid");
  if (!sid?.value) {
    throw new Error("Authentication token not found");
  }

  const response = await fetch(`${process.env.GRIDWALK_API}/workspaces`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sid?.value}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create workspace: ${response.statusText}`);
  }
}

export type Workspace = {
  id: string;
  name: string;
};

export type WorkspaceMember = {
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

// Logout action
export async function logout() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid");

  if (sid) {
    try {
      const response = await fetch(`${process.env.GRIDWALK_API}/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sid.value}`,
        },
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
    // Remove the sid cookie regardless of API call success
    cookieStore.delete("sid");
  }

  // Use redirect() after all operations are complete
  redirect("/");
}

export async function getWorkspaces(): Promise<Workspace[]> {
  const authToken = await getAuthToken();

  const response = await fetch(`${process.env.GRIDWALK_API}/workspaces`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  const data = await response.json();
  return data;
}
