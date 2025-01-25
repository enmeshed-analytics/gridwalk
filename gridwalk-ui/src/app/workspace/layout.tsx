import React from "react";
import { getProfile, getWorkspaces } from "./actions/actions";
import { Sidebar } from "./components/mainWorkspaceSidebar";
import { WorkspaceProvider } from "./workspaceContext";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profileData = await getProfile();
  const workspaceData = await getWorkspaces();

  const initials = `${profileData.first_name?.[0] || ""}${
    profileData.last_name?.[0] || ""
  }`.toUpperCase();

  return (
    <WorkspaceProvider workspaces={workspaceData}>
      <div className="flex h-screen">
        <Sidebar profileData={profileData} workspaceData={workspaceData} />
        <main className="flex-1 overflow-auto">
          <div className="flex items-center justify-end px-4 h-16 md:h-0">
            <div className="flex items-center justify-center md:h-0 w-8 h-8 rounded-full bg-gray-400 text-sm font-medium">
              {initials}
            </div>
          </div>
          {children}
        </main>
      </div>
    </WorkspaceProvider>
  );
}
