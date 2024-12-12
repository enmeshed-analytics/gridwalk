'use client'
import React, { useState } from "react";
import { FolderKanban, Plus, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateWorkspaceModal } from "./modal";
import { createWorkspace } from "./actions";
import { HelpSupportModal } from "./supportModal";

export default function WorkspacePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHelpSupportModalOpen, setIsHelpSupportModalOpen] = useState(false);

  const handleCreateWorkspace = async (name: string) => {
    await createWorkspace(name);
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 mb-12">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                GridWalk Workspaces
              </h1>
            </div>
            <p className="text-gray-600 text-lg">
              Manage and organise your projects across different workspaces.
            </p>
          </div>
          <Button
            className="w-full sm:w-auto bg-background text-white hover:bg-blue-600 hover:text-white"
            size="lg"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Workspace
          </Button>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center min-h-[400px] bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col items-center text-center max-w-md">
            <div className="bg-gray-50 p-4 rounded-full mb-6">
              <FolderKanban className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              No Workspace Selected
            </h2>
            <p className="text-gray-500 mb-6">
              Choose a workspace from the sidebar to view and manage your
              projects. Each workspace helps you organise related projects and
              collaborate with your team.
            </p>
          </div>
        </div>
      </div>

      {/* Help Button - Fixed to bottom right */}
      <div className="fixed bottom-0 right-0 p-6">
        <button
          onClick={() => setIsHelpSupportModalOpen(true)}
          className="bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group p-4"
          aria-label="Help and Support"
        >
          <HelpCircle className="w-6 h-6 text-blue-500 group-hover:text-blue-600" />
        </button>
      </div>

      {/* Modals */}
      <CreateWorkspaceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateWorkspace}
      />
      <HelpSupportModal
        isOpen={isHelpSupportModalOpen}
        onClose={() => setIsHelpSupportModalOpen(false)}
      />
    </div>
  );
}