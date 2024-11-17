"use client";
import React, { useState } from "react";
import { Plus } from "lucide-react";
import { CreateProjectModal } from "./projectModal";
import { useWorkspaces } from "../workspaceContext";
import { createProject } from "./actions";

interface WorkspaceProjectsClientProps {
  workspaceId: string;
  initialProjects: string[];
}

export default function WorkspaceProjectsClient({
  workspaceId,
  initialProjects,
}: WorkspaceProjectsClientProps) {
  const { workspaces } = useWorkspaces();
  const [projects, setProjects] = useState(initialProjects);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);

  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);

  const handleCreateProject = async (name: string) => {
    try {
      const newProject = await createProject({
        name: name.trim(),
        workspace_id: workspaceId,
      });

      setProjects((prevProjects) => [...prevProjects, newProject.name]);
      setIsProjectDialogOpen(false);
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message || "Failed to create project");
      }
      throw new Error("Failed to create project");
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
          <div className="space-y-2">
            <h1 className="sm:text-4xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600">
              Current Workspace: {currentWorkspace?.name || "Loading..."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setIsProjectDialogOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors w-full sm:w-auto justify-center sm:justify-start"
            >
              <Plus size={20} />
              New Project
            </button>
          </div>
        </div>
        <div className="mt-8">
          {projects.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No projects found. Create your first project!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project, index) => (
                <div
                  key={index}
                  className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  <h3 className="font-medium text-gray-900">{project}</h3>
                </div>
              ))}
            </div>
          )}
        </div>
        {isProjectDialogOpen && (
          <CreateProjectModal
            isOpen={isProjectDialogOpen}
            onClose={() => setIsProjectDialogOpen(false)}
            onSubmit={handleCreateProject}
          />
        )}
      </div>
    </div>
  );
}
