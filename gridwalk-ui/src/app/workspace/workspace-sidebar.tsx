"use client";
import React, { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Building2, Briefcase } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [workspaceName, setWorkspaceName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await onSubmit(workspaceName.trim());
      onClose();
      setWorkspaceName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Create New Workspace
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="workspaceName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Workspace Name
            </label>
            <input
              id="workspaceName"
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter workspace name..."
              minLength={3}
              maxLength={50}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !workspaceName.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  Creating...
                </>
              ) : (
                "Create Workspace"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

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
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false);
  const avatar = userName.charAt(0).toUpperCase();

  const handleCreateWorkspace = async (name: string) => {
    try {
      // Call the API to create a new workspace
      const response = await fetch("/api/new_workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create workspace");
      }

      window.location.reload();
    } catch (err) {
      console.error("Error creating workspace:", err);
      throw err;
    }
  };

  return (
    <Sidebar className="border-r border-gray-800">
      <SidebarContent>
        <SidebarHeader>
          <h1 className="text-2xl font-bold text-white">Workspaces</h1>
          <button
            onClick={() => setIsWorkspaceDialogOpen(true)}
            className="mt-1 flex items-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            <Briefcase size={20} />
            New Workspace
          </button>
        </SidebarHeader>

        <div className="flex-1 px-2">
          <div className="mb-4">
            <h2 className="px-3 text-sm font-semibold text-white uppercase tracking-wider">
              Your Workspaces
            </h2>
          </div>
          <SidebarMenu>
            {workspaceNames.map((workspace) => (
              <SidebarMenuItem key={workspace}>
                <Link
                  href={`/workspace/${encodeURIComponent(workspace)}`}
                  legacyBehavior
                  passHref
                >
                  <SidebarMenuButton className="text-gray-300">
                    <Building2 />
                    <span>{workspace}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        <SidebarFooter>
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{avatar}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="text-xs text-gray-400">{userEmail}</p>
            </div>
          </div>
        </SidebarFooter>
      </SidebarContent>

      {isWorkspaceDialogOpen && (
        <CreateWorkspaceModal
          isOpen={isWorkspaceDialogOpen}
          onClose={() => setIsWorkspaceDialogOpen(false)}
          onSubmit={handleCreateWorkspace}
        />
      )}
    </Sidebar>
  );
}
