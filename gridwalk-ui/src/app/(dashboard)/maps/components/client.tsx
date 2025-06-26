"use client";

import React, { useState, useEffect } from "react";
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
import { Map } from "@/app/types";

// Interface for the client component props
interface WorkspaceMapClientProps {
  workspaceId: string;
  initialMaps: Map[];
  currentWorkspace: { id: string; name: string };
}

// TODO: Descriptions and statuses are not being saved to the database for now
// We need to add them to the database and update the API to handle them when the backend is refactored
// Local storage is a temporary solution to store descriptions and statuses until the backend is updated
export default function WorkspaceMapClient({
  workspaceId,
  initialMaps = [],
}: WorkspaceMapClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Map | null>(null);

  // Add state to store temporary descriptions with localStorage
  const [tempDescriptions, setTempDescriptions] = useState<
    Record<string, string>
  >({});
  const [tempStatuses, setTempStatuses] = useState<Record<string, string>>({});

  // Add editing state
  const [editingField, setEditingField] = useState<{
    mapId: string;
    field: "description" | "status";
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Load descriptions from localStorage on component mount
  useEffect(() => {
    const descriptionsKey = `map-descriptions-${workspaceId}`;
    const statusesKey = `map-statuses-${workspaceId}`;

    const storedDescriptions = localStorage.getItem(descriptionsKey);
    const storedStatuses = localStorage.getItem(statusesKey);

    if (storedDescriptions) {
      try {
        setTempDescriptions(JSON.parse(storedDescriptions));
      } catch (error) {
        console.error("Failed to parse stored descriptions:", error);
      }
    }

    if (storedStatuses) {
      try {
        setTempStatuses(JSON.parse(storedStatuses));
      } catch (error) {
        console.error("Failed to parse stored statuses:", error);
      }
    }
  }, [workspaceId]);

  // Save descriptions to localStorage whenever they change
  const saveDescriptionToStorage = (mapId: string, description: string) => {
    const storageKey = `map-descriptions-${workspaceId}`;
    const newDescriptions = {
      ...tempDescriptions,
      [mapId]: description,
    };
    setTempDescriptions(newDescriptions);
    localStorage.setItem(storageKey, JSON.stringify(newDescriptions));
  };

  const saveStatusToStorage = (mapId: string, status: string) => {
    const storageKey = `map-statuses-${workspaceId}`;
    const newStatuses = { ...tempStatuses, [mapId]: status };
    setTempStatuses(newStatuses);
    localStorage.setItem(storageKey, JSON.stringify(newStatuses));
  };

  // Remove description from localStorage
  const removeDescriptionFromStorage = (mapId: string) => {
    const storageKey = `map-descriptions-${workspaceId}`;
    const newDescriptions = { ...tempDescriptions };
    delete newDescriptions[mapId];
    setTempDescriptions(newDescriptions);
    localStorage.setItem(storageKey, JSON.stringify(newDescriptions));
  };

  // Add remove status function
  const removeStatusFromStorage = (mapId: string) => {
    const storageKey = `map-statuses-${workspaceId}`;
    const newStatuses = { ...tempStatuses };
    delete newStatuses[mapId];
    setTempStatuses(newStatuses);
    localStorage.setItem(storageKey, JSON.stringify(newStatuses));
  };

  // Filter projects based on search query
  const filteredMaps = initialMaps.filter((map) =>
    map.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = async (
    name: string,
    description?: string,
    status?: string
  ) => {
    try {
      const result = await createMap({
        name: name.trim(),
        description: description?.trim() || undefined,
        workspace_id: workspaceId,
      });

      if (description?.trim()) {
        saveDescriptionToStorage(result.id, description.trim());
      }
      if (status?.trim()) {
        saveStatusToStorage(result.id, status.trim());
      }

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

      // Remove description from localStorage when map is deleted
      removeDescriptionFromStorage(selectedProject.id);
      removeStatusFromStorage(selectedProject.id);

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

    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
      // Invalid date string
      return "-";
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  // Handle inline editing
  const startEditing = (mapId: string, field: "description" | "status") => {
    const currentValue =
      field === "description" ? tempDescriptions[mapId] : tempStatuses[mapId];
    setEditValue(currentValue || "");
    setEditingField({ mapId, field });
  };

  const saveEdit = (mapId: string, field: "description" | "status") => {
    if (field === "description") {
      if (editValue.trim()) {
        saveDescriptionToStorage(mapId, editValue.trim());
      } else {
        removeDescriptionFromStorage(mapId);
      }
    } else {
      if (editValue.trim()) {
        saveStatusToStorage(mapId, editValue.trim());
      } else {
        removeStatusFromStorage(mapId);
      }
    }
    setEditingField(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
          <div>
            <CardTitle>Maps</CardTitle>
            <CardDescription>
              View and manage maps in this workspace.
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
      <CardContent className="h-96">
        <div className="h-full overflow-auto">
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
                    Description
                  </th>
                  <th
                    scope="col"
                    className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Status
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
                          <div className="md:hidden text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Created:
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Editable Description Column */}
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="max-w-xs">
                        {editingField?.mapId === map.id &&
                        editingField?.field === "description" ? (
                          <div className="flex items-center space-x-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="text-xs h-8"
                              placeholder="Enter description..."
                              maxLength={500}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  saveEdit(map.id, "description");
                                } else if (e.key === "Escape") {
                                  cancelEdit();
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600"
                              onClick={() => saveEdit(map.id, "description")}
                            >
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600"
                              onClick={cancelEdit}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="truncate cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded"
                            onClick={() => startEditing(map.id, "description")}
                            title="Click to edit description"
                          >
                            {tempDescriptions[map.id] ||
                              "Click to add description..."}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Editable Status Column */}
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="max-w-xs">
                        {editingField?.mapId === map.id &&
                        editingField?.field === "status" ? (
                          <div className="flex items-center space-x-2">
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="text-xs h-8"
                              placeholder="Enter status..."
                              maxLength={50}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  saveEdit(map.id, "status");
                                } else if (e.key === "Escape") {
                                  cancelEdit();
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-green-600"
                              onClick={() => saveEdit(map.id, "status")}
                            >
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600"
                              onClick={cancelEdit}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="truncate cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded"
                            onClick={() => startEditing(map.id, "status")}
                            title="Click to edit status"
                          >
                            {tempStatuses[map.id] || "Click to add status..."}
                          </div>
                        )}
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
          <div className="flex items-center justify-center h-full">
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
