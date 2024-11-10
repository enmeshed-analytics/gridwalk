"use client";
import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
  CreateProjectModal,
  LoadingSpinner,
  getProjects,
} from "./projectModal";

export default function WorkspaceProjectsPage() {
  const params = useParams();
  const router = useRouter();
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

  const handleProjectClick = () => {
    router.push(`/project`);
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
          <div className="space-y-2">
            <h1 className="sm:text-4xl font-bold text-gray-900">Projects</h1>
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
                    onClick={() => handleProjectClick()}
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
