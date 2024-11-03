import React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./workspace-sidebar";
import { Menu } from "lucide-react";
import { cookies } from "next/headers";

// Define the profile data type
type ProfileData = {
  first_name: string;
  email: string;
};

// Server action to fetch profile data
async function getProfile(): Promise<ProfileData> {
  try {
    // You can access cookies or headers here if needed
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sid").value;

    const response = await fetch(`${process.env.GRIDWALK_API}/profile`, {
      headers: {
        Authorization: `Bearer ${sessionId}`,
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
    // Return default values if fetch fails
    return {
      first_name: "",
      email: "",
    };
  }
}

// Mark the component as async
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch profile data on the server
  const profileData = await getProfile();

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <AppSidebar
          userName={profileData.first_name}
          userEmail={profileData.email}
        />
        <main className="flex-1 px-4 overflow-auto bg-gray-50">
          <div className="p-4">
            <SidebarTrigger className="lg:hidden">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
