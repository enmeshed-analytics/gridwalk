"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Trash2, MapPin } from "lucide-react";

import { CreateMapModal, DeleteMapModal } from "./map-modal";
import { createMap, deleteMap } from "../actions";
import { Map } from "../../types";

// Interface for the client component props
interface WorkspaceMapClientProps {
  workspaceId: string;
  initialMaps: Map[];
  currentWorkspace: { id: string; name: string };
}

export default function WorkspaceMapClient({
  workspaceId,
  initialMaps = [],
  currentWorkspace,
}: WorkspaceMapClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Map | null>(null);

  // Filter projects based on search query
  const filteredMaps = initialMaps.filter((map) =>
    map.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = async (name: string) => {
    try {
      await createMap({
        name: name.trim(),
        workspace_id: workspaceId,
      });
      setIsProjectDialogOpen(false);
      router.refresh();
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message || "Failed to create map");
      }
      throw new Error("Failed to create map");
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, map: Map) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedProject(map);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProject) return;
    try {
      await deleteMap(selectedProject.workspace_id, selectedProject.id);
      router.refresh();
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message || "Failed to delete map");
      }
      throw new Error("Failed to delete map");
    }
  };

  const formatDate = (timestamp: number | null): string => {
    if (!timestamp) return "-";

    // Convert Unix timestamp (seconds) to milliseconds
    const date = new Date(timestamp * 1000);

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
          <div>
            <CardTitle>Maps</CardTitle>
            <CardDescription>
              View and manage maps in{" "}
              {currentWorkspace?.name || "this workspace"}.
            </CardDescription>
          </div>
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input
                placeholder="Search maps..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              onClick={() => setIsProjectDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Map
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="border rounded-md">
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th
                    scope="col"
                    className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Map
                  </th>
                  <th
                    scope="col"
                    className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Created
                  </th>
                  <th
                    scope="col"
                    className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Last Modified
                  </th>
                  <th
                    scope="col"
                    className="relative px-4 sm:px-6 py-3 text-right"
                  >
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {filteredMaps.map((map) => (
                  <tr key={map.id}>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {map.name}
                          </div>
                          {/* Mobile-only date display */}
                          <div className="md:hidden text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Created: {formatDate(map.created_at)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(map.created_at)}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(map.updated_at)}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 dark:text-blue-400"
                          onClick={() => {
                            router.push(`/map/${map.workspace_id}/${map.id}`);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 dark:text-red-400"
                          onClick={(e) => handleDeleteClick(e, map)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredMaps.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No maps found</p>
          </div>
        )}
      </CardContent>

      {/* Modals */}
      <CreateMapModal
        isOpen={isProjectDialogOpen}
        onClose={() => setIsProjectDialogOpen(false)}
        onSubmit={handleCreateProject}
      />

      <DeleteMapModal
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setSelectedProject(null);
        }}
        mapId={selectedProject?.id || ""}
        mapName={selectedProject?.name || ""}
        onConfirm={handleDeleteConfirm}
      />
    </Card>
  );
}
