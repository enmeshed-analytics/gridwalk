import { FolderKanban } from "lucide-react";

export default function WorkspacePage() {
  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 mb-12">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Workspaces
              </h1>
            </div>
            <p className="text-gray-600 text-lg">
              Manage and organize your projects across different workspaces
            </p>
          </div>
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
              Choose a workspace from the sidebar to view and manage your projects. Each workspace helps you organize related projects and collaborate with your team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
