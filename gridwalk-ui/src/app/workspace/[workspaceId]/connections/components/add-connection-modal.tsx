"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DatabaseIcon, Plus } from "lucide-react";
import { createWorkspaceConnection } from "../actions";

interface AddConnectionModalProps {
  workspaceId: string;
}

export default function AddConnectionModal({ workspaceId }: AddConnectionModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Add Connection
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Connection</DialogTitle>
          <DialogDescription>
            Connect external services to your workspace
          </DialogDescription>
        </DialogHeader>
        <form action={createWorkspaceConnection}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="My Database"
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="connector_type" className="text-right">
                Connector Type
              </Label>
              <div className="col-span-3">
                <select 
                  id="connector_type" 
                  name="connector_type" 
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  defaultValue="database"
                >
                  <option value="postgis">PostGIS</option>
                  <option value="s3">S3</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="connection_string" className="text-right">
                Connection String
              </Label>
              <Input
                id="connection_string"
                name="connection_string"
                placeholder="postgres://username:password@hostname:port/database"
                className="col-span-3"
                required
                type="password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
              <DatabaseIcon className="mr-2 h-4 w-4" />
              Add Connection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
