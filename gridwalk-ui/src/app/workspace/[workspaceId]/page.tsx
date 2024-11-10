"use client";
import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";

type ApiResponse = {
  status: string;
  data: string[];
  error: string | null;
};

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Create New Project
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

async function getProjects(workspaceId: string): Promise<string[]> {
  try {
    const response = await fetch(
      `/api/get_projects?workspace_id=${workspaceId}`,
      {
        credentials: "include",
      },
    );
    if (!response.ok) {
      throw new Error("Failed to fetch projects");
    }
    const apiResponse = (await response.json()) as ApiResponse;

    if (!Array.isArray(apiResponse.data)) {
      console.warn("Projects data is not an array:", apiResponse.data);
      return [];
    }

    return apiResponse.data;
  } catch (error) {
    console.error("Error fetching projects:", error);
    return [];
  }
}

export default function WorkspaceProjectsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [projects, setProjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    getProjects(workspaceId)
      .then((fetchedProjects) => {
        setProjects(fetchedProjects);
        setError(null);
      })
      .catch((err) => {
        setError("Failed to load projects");
        console.error(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [workspaceId]);

  const handleCreateProject = async (name: string) => {
    const response = await fetch("/api/project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: name.trim(),
        workspace_id: workspaceId,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to create project");
    }

    const updatedProjects = await getProjects(workspaceId);
    setProjects(updatedProjects);
  };

  const getProjectVersion = (name: string) => {
    const versionMatch = name.match(/v(\d+\.\d+)$/);
    return versionMatch ? parseFloat(versionMatch[1]) : null;
  };

  const sortProjects = (projects: string[]) => {
    return [...projects].sort((a, b) => {
      const versionA = getProjectVersion(a);
      const versionB = getProjectVersion(b);

      if (versionA !== null && versionB !== null) {
        return versionB - versionA;
      }
      if (versionA !== null) return -1;
      if (versionB !== null) return 1;
      return a.localeCompare(b);
    });
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Projects
            </h1>
            <p className="text-gray-600">Workspace: {workspaceId}</p>
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

        {/* Rest of the existing JSX */}
        <div className="mt-8">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <LoadingSpinner />
              <span className="ml-2 text-gray-600">Loading projects...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
          ) : projects.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              No projects found. Create your first project!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortProjects(projects).map((projectName, index) => {
                const version = getProjectVersion(projectName);
                const baseName = version
                  ? projectName.replace(` v${version}`, "")
                  : projectName;

                return (
                  <div
                    key={`${projectName}-${index}`}
                    className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow group cursor-pointer"
                  >
                    <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                      {baseName}
                    </h3>
                    {version && (
                      <div className="mt-2 inline-block px-2 py-1 bg-gray-100 rounded-md text-sm text-gray-600">
                        v{version}
                      </div>
                    )}
                  </div>
                );
              })}
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
