"use client";
import React, { useState } from "react";
import { Plus, UserPlus, Users, ChevronDown } from "lucide-react";
import { CreateProjectModal } from "./projectModal";
import { AddWorkspaceMemberModal } from "./addMemberModal";
import { ViewWorkspaceMemberModal } from "./viewMembersModal";
import { useWorkspaces } from "../workspaceContext";
import { createProject } from "./actions/projects/create";
import { addWorkspaceMember } from "./actions/workspace";
import { useRouter } from "next/navigation";

interface WorkspaceProjectsClientProps {
  workspaceId: string;
  initialProjects: string[];
}

export default function WorkspaceProjectsClient({
  workspaceId,
  initialProjects,
}: WorkspaceProjectsClientProps) {
  const router = useRouter();
  const { workspaces } = useWorkspaces();
  const [projects, setProjects] = useState(initialProjects);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [isViewMemberDialogOpen, setIsViewMemberDialogOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(true);
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

  const handleProjectClick = (projectName: string) => {
    const safeProjectName = encodeURIComponent(
      projectName.toLowerCase().replace(/\s+/g, "-"),
    );
    router.push(`/project/${workspaceId}/${safeProjectName}`);
  };

  const handleAddMember = async (email: string, role: "Admin" | "Read") => {
    try {
      await addWorkspaceMember({
        workspace_id: workspaceId,
        email: email.trim(),
        role,
      });
      setIsMemberDialogOpen(false);
      if (isViewMemberDialogOpen) {
        setIsViewMemberDialogOpen(false);
        setIsViewMemberDialogOpen(true);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message || "Failed to add member");
      }
      throw new Error("Failed to add member");
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6">
        <div className="relative">
          {/* Header with workspace name and accordion toggle */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="sm:text-4xl font-bold">
              <span className="text-black">Current Workspace:</span>{" "}
              <span className="text-gray-900">
                {currentWorkspace?.name || "Loading..."}
              </span>
            </h1>
            <button
              onClick={() => setIsActionsOpen(!isActionsOpen)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors bg-white px-3 py-1.5 rounded-lg shadow-sm"
            >
              Settings
              <div
                className={`rounded-full p-1 transition-colors duration-200 ${
                  isActionsOpen ? "bg-green-500" : "bg-black"
                }`}
              >
                <ChevronDown
                  className={`h-4 w-4 text-white transition-transform duration-200 ${
                    isActionsOpen ? "transform rotate-180" : ""
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Vertical actions dropdown */}
          {isActionsOpen && (
            <div className="absolute right-0 top-12 z-10 bg-white shadow-lg rounded-lg overflow-hidden min-w-[160px]">
              <div className="flex flex-col">
                <button
                  onClick={() => setIsViewMemberDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors w-full text-left"
                >
                  <Users size={16} />
                  View Members
                </button>
                <button
                  onClick={() => setIsMemberDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors w-full text-left"
                >
                  <UserPlus size={16} />
                  Add Member
                </button>
                <button
                  onClick={() => setIsProjectDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors w-full text-left"
                >
                  <Plus size={16} />
                  New Project
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Projects grid */}
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
                  onClick={() => handleProjectClick(project)}
                  className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                >
                  <h3 className="font-medium text-gray-900">{project}</h3>
                </div>
              ))}
            </div>
          )}
        </div>

        <CreateProjectModal
          isOpen={isProjectDialogOpen}
          onClose={() => setIsProjectDialogOpen(false)}
          onSubmit={handleCreateProject}
        />

        <AddWorkspaceMemberModal
          isOpen={isMemberDialogOpen}
          onClose={() => setIsMemberDialogOpen(false)}
          onSubmit={handleAddMember}
        />

        <ViewWorkspaceMemberModal
          isOpen={isViewMemberDialogOpen}
          onClose={() => setIsViewMemberDialogOpen(false)}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  );
}
