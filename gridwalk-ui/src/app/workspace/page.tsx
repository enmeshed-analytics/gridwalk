"use client";
import React, { useState } from "react";
import { Plus } from "lucide-react";

interface Project {
  title: string;
  description: string;
  status: "Not Started" | "Planning" | "In Progress" | "Completed";
}

interface ProjectCardProps {
  project: Project;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => (
  <div className="group hover:shadow-lg transition-all duration-300 bg-white rounded-lg overflow-hidden border border-gray-200">
    <div className="aspect-video w-full relative overflow-hidden bg-slate-100">
      <img
        src="/map-placeholder.png"
        alt={`Map preview for ${project.title}`}
        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
      />
      <div className="absolute top-2 right-2">
        <StatusBadge status={project.status} />
      </div>
    </div>
    <div className="p-4">
      <h3 className="text-xl font-bold text-slate-900 line-clamp-1">
        {project.title}
      </h3>
      <p className="text-slate-600 font-medium line-clamp-2 mt-2">
        {project.description}
      </p>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: Project["status"] }> = ({ status }) => {
  const colors = {
    "Not Started": "bg-gray-100 text-gray-700",
    Planning: "bg-yellow-100 text-yellow-700",
    "In Progress": "bg-blue-100 text-blue-700",
    Completed: "bg-green-100 text-green-700",
  };

  return (
    <span
      className={`${colors[status]} px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm`}
    >
      {status}
    </span>
  );
};

const CreateProjectModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}> = ({ isOpen, onClose, onSubmit }) => {
  const [projectName, setProjectName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await onSubmit(projectName.trim());
      onClose();
      setProjectName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create New Project</h2>
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
              htmlFor="projectName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Project Name
            </label>
            <input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter project name..."
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
              disabled={isLoading || !projectName.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  Creating...
                </>
              ) : (
                "Create Project"
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

export default function Workspace() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const projects: Project[] = [
    {
      title: "Downtown District Mapping",
      description:
        "Detailed street-level mapping of the central business district",
      status: "In Progress",
    },
    {
      title: "Parks & Recreation Zones",
      description:
        "Comprehensive mapping of public recreational areas and green spaces",
      status: "Planning",
    },
    {
      title: "Historic Districts Survey",
      description: "Documentation and mapping of heritage sites and landmarks",
      status: "Not Started",
    },
  ];

  const handleCreateProject = async (name: string) => {
    const response = await fetch("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: name.trim() }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to create project");
    }
  };

  return (
    <div className="mt-4 container mx-auto px-4">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Map Projects
          </h1>
          <p className="text-slate-600 text-lg font-medium">
            Geographic information systems and mapping initiatives
          </p>
        </div>

        <button
          onClick={() => setIsDialogOpen(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          New Project
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, index) => (
          <ProjectCard key={index} project={project} />
        ))}
      </div>

      <CreateProjectModal
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleCreateProject}
      />
    </div>
  );
}
