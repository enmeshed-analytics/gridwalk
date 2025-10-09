'use server';
import { cookies } from "next/headers";

export async function getAuthToken() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid");

  if (!sid?.value) {
    throw new Error("Authentication token not found");
  }

  return sid.value;
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

