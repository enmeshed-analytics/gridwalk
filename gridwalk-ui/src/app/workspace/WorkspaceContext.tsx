"use client";
import React, { createContext, useContext } from "react";

type Workspace = {
  id: string;
  name: string;
};

type WorkspaceContextType = {
  workspaces: Workspace[];
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

export function WorkspaceProvider({
  children,
  workspaces,
}: {
  children: React.ReactNode;
  workspaces: Workspace[];
}) {
  return (
    <WorkspaceContext.Provider value={{ workspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaces() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspaces must be used within a WorkspaceProvider");
  }
  return context;
}
