"use client";

import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ProfileData, Workspace } from "../actions";
import { ClientSidebarContent } from "./sidebar-content";

interface ClientMobileSidebarProps {
  profileData: ProfileData;
  workspaceData: Workspace;
}

export function ClientMobileSidebar({
  profileData,
  workspaceData,
}: ClientMobileSidebarProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="absolute bg-blue-600 hover:bg-blue-700 text-white top-4 left-4 shadow-md"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64 border-r-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <ClientSidebarContent
          profileData={profileData}
          workspaceData={workspaceData}
        />
      </SheetContent>
    </Sheet>
  );
}
