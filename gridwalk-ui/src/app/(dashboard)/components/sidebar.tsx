import { Suspense } from "react";
import { getProfile, getWorkspaces } from "../actions";
import { ClientSidebarContent } from "./sidebar-content";
import { ClientMobileSidebar } from "./sidebar-content-mobile";

interface SidebarProps {
  workspaces?: Array<{
    id: string;
    name: string;
  }>;
}

export async function Sidebar({ workspaces }: SidebarProps) {
  // Fetch data on the server
  const profile = await getProfile();

  return (
    <>
      {/* Desktop sidebar - static container rendered on server */}
      <div className="hidden md:block">
        <aside className="w-64 border-r border-gray-200 dark:border-gray-800 h-full bg-gray-50 dark:bg-gray-900">
          <Suspense fallback={<div className="p-4">Loading sidebar...</div>}>
            {/* Client component for interactive parts */}
            <ClientSidebarContent
              profileData={profile}
              workspaces={workspaces}
            />
          </Suspense>
        </aside>
      </div>

      {/* Mobile sidebar - static container rendered on server */}
      <div className="block md:hidden">
        <Suspense fallback={<div>Loading mobile menu...</div>}>
          {/* Client component for mobile interactive parts */}
          <ClientMobileSidebar
            profileData={profile}
            workspaceData={workspaces}
          />
        </Suspense>
      </div>
    </>
  );
}
