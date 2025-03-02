// ServerSidebar.tsx - Server Component
import { Suspense } from "react";
import { getProfile, getWorkspaces } from "../actions";
import { ClientSidebarContent } from "./sidebar-content";
import { ClientMobileSidebar } from "./sidebar-content-mobile";

// This function fetches data on the server
async function fetchSidebarData() {
  // Replace these with your actual data fetching functions
  const profileData = await getProfile();
  const workspaceData = await getWorkspaces();
  
  return {
    profileData,
    workspaceData
  };
}

export async function ServerSidebar() {
  // Fetch data on the server
  const { profileData, workspaceData } = await fetchSidebarData();
  
  return (
    <>
      {/* Desktop sidebar - static container rendered on server */}
      <div className="hidden md:block">
        <aside className="w-64 border-r border-gray-200 dark:border-gray-800 h-full bg-gray-50 dark:bg-gray-900">
          <Suspense fallback={<div className="p-4">Loading sidebar...</div>}>
            {/* Client component for interactive parts */}
            <ClientSidebarContent 
              profileData={profileData} 
              workspaceData={workspaceData} 
            />
          </Suspense>
        </aside>
      </div>
      
      {/* Mobile sidebar - static container rendered on server */}
      <div className="block md:hidden">
        <Suspense fallback={<div>Loading mobile menu...</div>}>
          {/* Client component for mobile interactive parts */}
          <ClientMobileSidebar 
            profileData={profileData} 
            workspaceData={workspaceData} 
          />
        </Suspense>
      </div>
    </>
  );
}
