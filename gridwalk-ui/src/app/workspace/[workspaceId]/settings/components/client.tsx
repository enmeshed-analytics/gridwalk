"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Settings, Trash2, InfoIcon } from "lucide-react";

interface WorkspaceSettingsClientProps {
  workspaceId: string;
  workspaceName: string;
  onUpdateName: (newName: string) => Promise<void>;
  onDeleteWorkspace: () => Promise<void>;
}

export default function WorkspaceSettingsClient({ 
  workspaceName,
  onDeleteWorkspace
}: WorkspaceSettingsClientProps) {
  const [name, setName] = useState(workspaceName);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteWorkspace = async () => {
    setIsDeleting(true);
    try {
      await onDeleteWorkspace();
    } catch (error) {
      console.error("Failed to delete workspace:", error);
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Workspace Settings</CardTitle>
                <CardDescription>
                  Manage settings for this workspace.
                </CardDescription>
              </div>
              <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="workspace-name">Workspace Name</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Name editing coming soon</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex gap-4">
                  <Input
                    id="workspace-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="max-w-md"
                    disabled
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button 
                            disabled={true}
                            className="cursor-not-allowed"
                          >
                            Update
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Not available</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-red-600 dark:text-red-400">Danger Zone</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Once you delete a workspace, there is no going back. Please be certain.
                  </p>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="mt-2">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Workspace
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the
                          workspace &quot;{workspaceName}&quot; and all associated connections and data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteWorkspace}
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {isDeleting ? "Deleting..." : "Delete Workspace"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
