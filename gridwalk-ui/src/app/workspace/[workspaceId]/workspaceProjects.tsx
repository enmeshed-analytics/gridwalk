"use client";
import React, { useState } from "react";
import { Plus, UserPlus, Users, ChevronDown, Trash2 } from "lucide-react";
import { CreateProjectModal, DeleteProjectModal } from "./projectModal";
import { AddWorkspaceMemberModal } from "./addMemberModal";
import { ViewWorkspaceMemberModal } from "./viewMembersModal";
import { useWorkspaces } from "../workspaceContext";
import { createProject } from "./actions/projects/create";
import { deleteProject } from "./actions/projects/delete";
import { addWorkspaceMember } from "./actions/workspace";
import { useRouter } from "next/navigation";

interface Project {
  workspace_id: string;
  id: string;
  name: string;
  uploaded_by: string;
  created_at: number;
}

interface WorkspaceProjectsClientProps {
  workspaceId: string;
  initialProjects: Project[];
}

export default function WorkspaceProjectsClient({
  workspaceId,
  initialProjects,
}: WorkspaceProjectsClientProps) {
  const router = useRouter();
  const { workspaces } = useWorkspaces();
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false);
  const [isViewMemberDialogOpen, setIsViewMemberDialogOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);

  const handleCreateProject = async (name: string) => {
    try {
      await createProject({
        name: name.trim(),
        workspace_id: workspaceId,
      });
      setIsProjectDialogOpen(false);
      router.refresh();
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message || "Failed to create project");
      }
      throw new Error("Failed to create project");
    }
  };

  const handleProjectClick = (project: Project) => {
    router.push(`/project/${project.workspace_id}/${project.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setSelectedProject(project);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProject) return;
    try {
      await deleteProject(selectedProject.workspace_id, selectedProject.id);
      router.refresh();
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message || "Failed to delete project");
      }
      throw new Error("Failed to delete project");
    }
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
          {initialProjects.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No projects found. Create your first project!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {initialProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => handleProjectClick(project)}
                  className="p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer group relative"
                >
                  <h3 className="font-medium text-gray-900">{project.name}</h3>
                  <button
                    onClick={(e) => handleDeleteClick(e, project)}
                    className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-500  transition-opacity"
                    aria-label="Delete project"
                  >
                    <Trash2 size={16} />
                  </button>
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

        <DeleteProjectModal
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setSelectedProject(null);
          }}
          projectName={selectedProject?.name || ""}
          onConfirm={handleDeleteConfirm}
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
