import React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./workspace-sidebar";
import { Menu } from "lucide-react";
import { cookies } from "next/headers";
import { getProfile, getWorkspaces } from './actions'

export const dynamic = 'force-dynamic';

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
          workspaces={workspaceData}
        />
        <main className="flex-1 overflow-auto bg-gray-50 w-full">
          <div className="flex flex-col h-full">
            <div className="lg:hidden p-4">
              <SidebarTrigger>
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
            </div>
            <div className="flex-1">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
