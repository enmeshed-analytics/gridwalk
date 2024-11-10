import React from "react";

export default function WorkspacePage() {
  return (
    <div className="w-full h-full bg-gray-50">
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Workspaces
            </h1>
            <p className="text-gray-500">Select a workspace to view projects</p>
          </div>
        </div>
        <div className="mt-8 flex items-center justify-center h-64 text-gray-500">
          Choose a workspace from the sidebar to view its projects
        </div>
      </div>
    </div>
  );
}
