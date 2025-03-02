import WorkspaceSettingsClient from "./components/client";
import { getWorkspaces } from "../actions";

interface PageProps {
  params: {
    workspaceId: string;
  };
}

export default async function WorkspaceConnectionsPage({ params }: PageProps) {
  const { workspaceId } = await params;
  const workspaces = await getWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  
  return (
    <WorkspaceSettingsClient 
      workspaceId={workspaceId} 
      workspaceName={workspace.name} 
    />
  );
}
