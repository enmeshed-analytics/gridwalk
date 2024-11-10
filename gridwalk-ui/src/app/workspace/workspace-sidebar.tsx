import React from "react";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { Building2, FolderKanban } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

interface AppSidebarProps {
  userName?: string;
  userEmail?: string;
  workspaceNames?: string[];
}

export function AppSidebar({
  userName = "",
  userEmail = "",
  workspaceNames = [],
}: AppSidebarProps) {
  const avatar = userName.charAt(0).toUpperCase();

  return (
    <Sidebar className="border-r">
      <SidebarContent>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="px-4 py-6">
            <h1 className="text-xl font-bold">Workspaces</h1>
          </div>

          <div className="flex-1 px-2">
            <div className="mb-4">
              <h2 className="px-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Your Workspaces
              </h2>
            </div>
            <nav className="space-y-1">
              {workspaceNames.map((workspace) => (
                <Link
                  key={workspace}
                  href={`/workspace/${encodeURIComponent(workspace)}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 group"
                >
                  <Building2 className="h-5 w-5 text-gray-500 group-hover:text-gray-900" />
                  {workspace}
                </Link>
              ))}
            </nav>
          </div>

          <div className="px-2 mb-4">
            <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">
              <FolderKanban className="h-5 w-5" />
              New Workspace
            </button>
          </div>

          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{avatar}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-gray-500">{userEmail}</p>
              </div>
            </div>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
