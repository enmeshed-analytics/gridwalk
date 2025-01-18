"use client";
import React, { createContext, useContext } from "react";

// Define the shape of a single workspace object and the context type
type Workspace = {
  id: string;
  name: string;
};

type WorkspaceContextType = {
  workspaces: Workspace[];
};

// Create a context to share workspace data across components
const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

// Provider component that makes workspaces data available to child components
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

// Custom hook to consume workspace data from any child component
export function useWorkspaces() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspaces must be used within a WorkspaceProvider");
  }
  return context;
}
