'use server'
import { cookies } from 'next/headers'

type ProfileData = {
  first_name: string;
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
      email: data.email || "email@example.com",
    };
  } catch (error) {
    console.error("Error fetching profile:", error);
    return {
      first_name: "",
      email: "",
    };
  }
}

export async function getWorkspaces() {
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
