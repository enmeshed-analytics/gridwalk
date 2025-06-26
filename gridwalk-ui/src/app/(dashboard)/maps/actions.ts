"use server";

import { getAuthToken } from "@/app/utils";
import { revalidatePath } from "next/cache";
import { Map } from "../../types";

export type CreateMapRequest = {
  name: string;
  description?: string;
  workspace_id: string;
};

export type MapData = {
  id: string;
  name: string;
  workspace_id: string;
};

export async function createMap(data: CreateMapRequest): Promise<MapData> {
  const token = await getAuthToken();

  if (!data.workspace_id) throw new Error("Workspace ID is required");
  if (!data.name) throw new Error("Map name is required");

  const response = await fetch(
    `${process.env.GRIDWALK_API}/workspaces/${data.workspace_id}/maps`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: data.name.trim(),
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401) throw new Error("Authentication failed");
    throw new Error(errorText || "Failed to create map");
  }

  const mapData = await response.json();
  revalidatePath(`/maps?workspace=${data.workspace_id}`);
  return mapData;
}

export async function getMaps(workspaceId: string): Promise<Map[]> {
  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }

  const token = await getAuthToken();

  try {
    const response = await fetch(
      `${process.env.GRIDWALK_API}/workspaces/${workspaceId}/maps`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error("Authentication failed");
      }
      throw new Error(errorText || "Failed to fetch projects");
    }

    const mapsData: Map[] = await response.json();

    if (!Array.isArray(mapsData)) {
      console.warn("Maps data is not an array:", mapsData);
      return [];
    }

    return mapsData;
  } catch (error) {
    console.error("Failed to fetch maps:", error);
    throw error;
  }
}

export async function deleteMap(
  workspaceId: string,
  mapId: string
): Promise<void> {
  const token = await getAuthToken();
  if (!workspaceId) throw new Error("Workspace ID is required");
  if (!mapId) throw new Error("Map ID is required");

  const response = await fetch(
    `${process.env.GRIDWALK_API}/workspaces/${workspaceId}/maps/${mapId}`,
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
    if (response.status === 404) throw new Error("Map or workspace not found");
    throw new Error(errorText || "Failed to delete map");
  }

  // Revalidate the maps list page to reflect the deletion
  revalidatePath(`/maps?workspace=${workspaceId}`);
}
