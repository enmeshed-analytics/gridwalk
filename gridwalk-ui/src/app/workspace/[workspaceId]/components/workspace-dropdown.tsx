"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronDown, Plus, Briefcase } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Workspace, createWorkspace, getWorkspaces } from "../actions";
import { CreateWorkspaceSidebar } from "../../components/create-workspace-modal";

interface ClientWorkspaceDropdownProps {
  workspaces: Workspace[];
}

export function ClientWorkspaceDropdown({
  workspaces,
}: ClientWorkspaceDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(
    null
  );

  useEffect(() => {
    const currentWorkspaceId = pathname?.split("/")[2];
    const currentWorkspace = workspaces.find(
      (w) => w.id === currentWorkspaceId
    );

    if (currentWorkspace) {
      setSelectedWorkspace(currentWorkspace.name);
    } else if (workspaces.length > 0) {
      setSelectedWorkspace(workspaces[0].name);
    }
  }, [pathname, workspaces]);

  const handleCreateWorkspace = async (name: string): Promise<void> => {
    try {
      setIsNavigating(true);

      // Create the new workspace
      await createWorkspace(name);

      // Fetch updated workspaces list
      const updatedWorkspaces = await getWorkspaces();

      // Find the newly created workspace by name
      const newWorkspace = updatedWorkspaces.find((w) => w.name === name);

      if (newWorkspace) {
        setIsCreateModalOpen(false);
        // Navigate to the new workspace
        // Does this in the same way that the handleWorkspaceSelect.
        const pathSegments = pathname?.split("/");
        const currentSection = pathSegments?.[3] || "maps";
        router.push(`/workspace/${newWorkspace.id}/${currentSection}`);
      }

      router.refresh();
    } catch (error) {
      console.error("Error creating workspace:", error);
    } finally {
      setIsNavigating(false);
    }
  };

  const handleWorkspaceSelect = async (id: string, name: string) => {
    if (isNavigating) return;
    try {
      setIsNavigating(true);
      setSelectedWorkspace(name);
      const pathSegments = pathname?.split("/");
      const currentSection = pathSegments?.[3] || "maps";
      router.push(`/workspace/${id}/${currentSection}`);
    } catch (error) {
      console.error("Navigation error:", error);
      const currentWorkspaceId = pathname?.split("/")[2];
      const currentWorkspace = workspaces.find(
        (w) => w.id === currentWorkspaceId
      );
      if (currentWorkspace) {
        setSelectedWorkspace(currentWorkspace.name);
      }
    } finally {
      setTimeout(() => setIsNavigating(false), 500);
    }
  };

  return (
    <div className="space-y-4">
      <div className="px-4 py-3">
        <div className="flex flex-col gap-4">
          <h2 className="text-blue-600 dark:text-blue-400 font-bold text-xl">
            GridWalk
          </h2>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Workspace
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="hover:bg-blue-100 dark:hover:bg-blue-900/40 p-1 h-6 w-6 rounded-full"
              title="Create new workspace"
            >
              <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full flex items-center justify-between bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:border-blue-500 dark:hover:border-blue-400 border-gray-300 dark:border-gray-600 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium"
                disabled={isNavigating}
              >
                <div className="flex items-center">
                  <Briefcase className="h-4 w-4 mr-2 text-blue-500 dark:text-blue-400" />
                  <span className="truncate">
                    {selectedWorkspace || "Select Workspace"}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-md p-1"
              align="start"
            >
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() =>
                    handleWorkspaceSelect(workspace.id, workspace.name)
                  }
                  className={`cursor-pointer py-2 px-3 rounded-md text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 focus:bg-blue-50 dark:focus:bg-blue-900/30 focus:text-blue-600 dark:focus:text-blue-400 transition-colors ${
                    selectedWorkspace === workspace.name
                      ? "bg-blue-50 dark:bg-blue-900/30"
                      : ""
                  }`}
                  disabled={isNavigating}
                >
                  {workspace.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CreateWorkspaceSidebar
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateWorkspace}
      />
    </div>
  );
}
