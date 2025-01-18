"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Sidebar for the initial workspace page -
// It appears on righthand side of the main workspaces page
interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onCreate,
}: CreateWorkspaceModalProps) {
  // Define state
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  // Define what happens when creating new workspace submission
  const handleSubmit = async () => {
    const trimmedName = workspaceName.trim();
    if (!trimmedName) {
      setError("Workspace name cannot be empty");
      return;
    }
    if (trimmedName.length < 3) {
      setError("Workspace name must be at least 3 characters long");
      return;
    }

    try {
      setIsCreating(true);
      setError("");
      await onCreate(trimmedName);
      setWorkspaceName("");
      setSuccess("Workspace created successfully");

      // Use Promise to handle the delay more cleanly
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onClose();
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("duplicate")) {
          setError("A workspace with this name already exists");
        } else if (error.message.includes("unauthorized")) {
          setError("You don't have permission to create workspaces");
        } else {
          setError(error.message);
        }
      } else {
        setError("Failed to create workspace. Please try again.");
      }
      console.error("Error creating workspace:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace Name</Label>
            <Input
              id="name"
              placeholder="Enter workspace name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-green-500">{success}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !workspaceName.trim()}
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Create worksapce modal for the sidebar - appears as a "+" next to the sidebar title
interface CreateWorkspaceSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

// THIS WORKS THE SAME WAY AS THE MODAL ABOVE
export function CreateWorkspaceSidebar({
  isOpen,
  onClose,
  onCreate,
}: CreateWorkspaceSidebarProps) {
  // Set state
  const [workspaceName, setWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Define what happens when creating new workspace submission
  const handleSubmit = async () => {
    if (!workspaceName.trim()) return;
    try {
      setIsCreating(true);
      await onCreate(workspaceName);
      setWorkspaceName("");
      onClose();
    } catch (error) {
      console.error("Error creating workspace:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace Name</Label>
            <Input
              id="name"
              placeholder="Enter workspace name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !workspaceName.trim()}
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
