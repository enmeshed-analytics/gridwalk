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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail } from "lucide-react";
import { addWorkspaceMember as inviteMember } from "../actions";

interface AddMemberModalProps {
  workspaceId: string;
  className?: string;
}

export default function AddMemberModal({ workspaceId }: AddMemberModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  async function onSubmit(formData: FormData) {
    const data = {
      workspace_id: workspaceId,
      email: formData.get("email") as string,
      role: formData.get("role") as "Admin" | "Read",
    };

    try {
      await inviteMember(data);
      setIsOpen(false);
    } catch (error) {
      console.error("Error adding member:", error);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
          <UserPlus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
          <DialogDescription>
            Add a new member to your workspace
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                placeholder="member@example.com"
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <div className="col-span-3">
                <select
                  id="role"
                  name="role"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  defaultValue="Read"
                >
                  <option value="Admin">Admin</option>
                  <option value="Read">Read</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Mail className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
