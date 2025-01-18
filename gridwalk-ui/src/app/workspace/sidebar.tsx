"use client";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, ChevronDown, Plus, Briefcase } from "lucide-react";
import { ProfileData, Workspaces, logout, createWorkspace } from "./actions";
import { CreateWorkspaceSidebar } from "./createWorkspaceModal";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import ProfileModal from "./profileModal";

interface SidebarProps {
  profileData: ProfileData;
  workspaceData: Workspaces;
}

const LogoutButton = () => {
  const router = useRouter();
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/");
    }
  };
  return (
    <Button
      variant="ghost"
      className="w-full justify-start text-blue-500 hover:text-white hover:bg-blue-500 dark:hover:bg-blue-500"
      onClick={handleLogout}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </Button>
  );
};

const WorkspaceAccordion = ({ workspaces }: { workspaces: Workspaces }) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsOpen(true);
  }, []);

  const handleCreateWorkspace = async (name: string) => {
    try {
      await createWorkspace(name);
      router.refresh();
    } catch (error) {
      console.error("Error creating workspace:", error);
    }
  };

  return (
    <div className="space-y-2">
      <div className="px-4 py-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-gray-700 font-semibold italic text-lg">
            GridWalk
          </h2>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold">New Workspace</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="hover:bg-gray-700 hover:text-white p-1 h-6 w-6 flex"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-3 focus:ring-blue-500 font-medium text-sm"
        >
          <h2 className="text-sm font-semibold">Select Workspace</h2>
          <div
            className={`rounded-full p-0.7 transition-colors duration-200 shadow hover:shadow-green-400 ${
              mounted && isOpen ? "bg-green-500" : "bg-black"
            }`}
          >
            <ChevronDown
              className={`h-4 w-4 text-white transition-transform duration-200 ${
                mounted && isOpen ? "transform rotate-180" : ""
              }`}
            />
          </div>
        </button>
      </div>
      <div
        className={`space-y-1 px-2 overflow-hidden transition-all duration-200 ease-in-out ${
          mounted && isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {workspaces.map((workspace) => (
          <Link
            key={workspace.id}
            href={`/workspace/${workspace.id}`}
            className="w-full text-left py-1.5 px-3 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-700 hover:text-white dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium group flex items-center gap-2"
          >
            <Briefcase className="h-4 w-4 text-white dark:text-white" />
            <span className="flex-1 text-xs">{workspace.name}</span>
          </Link>
        ))}
      </div>
      <CreateWorkspaceSidebar
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateWorkspace}
      />
    </div>
  );
};

const SidebarContent = ({ profileData, workspaceData }: SidebarProps) => (
  <div className="h-full flex flex-col">
    <ScrollArea className="flex-1">
      <WorkspaceAccordion workspaces={workspaceData} />
    </ScrollArea>
    <div className="p-4 border-t">
      <div className="space-y-4">
        <ProfileModal profileData={profileData} />
        <LogoutButton />
      </div>
    </div>
  </div>
);

export function Sidebar({ profileData, workspaceData }: SidebarProps) {
  return (
    <>
      <div className="hidden md:block">
        <aside className="w-58 border-r h-full">
          <SidebarContent
            profileData={profileData}
            workspaceData={workspaceData}
          />
        </aside>
      </div>
      <div className="block md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="absolute bg-blue-600/60 top-4 left-4"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent
              profileData={profileData}
              workspaceData={workspaceData}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
