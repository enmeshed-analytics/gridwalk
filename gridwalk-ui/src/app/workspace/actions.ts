'use server'
import { cookies } from 'next/headers'

export type ProfileData = {
  first_name: string;
  last_name: string;
  email: string;
}

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

export type Workspace = {
  id: string;
    name: string;
}

export type Workspaces = Workspace[];

export async function getWorkspaces(): Promise<Workspaces> {
  const cookieStore = await cookies()
  const sid = cookieStore.get('sid')
  const response = await fetch(`${process.env.GRIDWALK_API}/workspaces`, {
    headers: {
      Authorization: `Bearer ${sid?.value}`
    }
  })
  const data = await response.json()

  return data
}
