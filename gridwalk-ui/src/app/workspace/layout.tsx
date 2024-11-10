import React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./workspace-sidebar";
import { Menu } from "lucide-react";
import { cookies } from "next/headers";

type ProfileData = {
  first_name: string;
  email: string;
};

type WorkspaceData = {
  workspaces: string[];
};

async function getProfile(): Promise<ProfileData> {
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

async function getWorkspaces(): Promise<WorkspaceData> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("sid");

    if (!sessionCookie?.value) {
      throw new Error("No session cookie found");
    }

    const response = await fetch(`${process.env.GRIDWALK_API}/get_workspaces`, {
      headers: {
        Authorization: `Bearer ${sessionCookie.value}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch workspaces");
    }

    const data = await response.json();
    console.log("Workspace data received:", data);
    return {
      workspaces: data,
    };
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return {
      workspaces: [],
    };
  }
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profileData = await getProfile();
  const workspaceData = await getWorkspaces();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <AppSidebar
          userName={profileData.first_name}
          userEmail={profileData.email}
          workspaceNames={workspaceData.workspaces}
        />
        <main className="flex-1 overflow-auto bg-gray-50 w-full">
          <div className="h-full w-full">
            <SidebarTrigger className="lg:hidden p-4">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            {React.cloneElement(children as React.ReactElement, {
              workspaceNames: workspaceData.workspaces,
            })}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
