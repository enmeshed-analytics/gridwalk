import { redirect } from "next/navigation";
import WorkspaceSettingsClient from "./components/client";
import { getWorkspaces } from "../actions";
import { deleteWorkspace } from "./actions";

interface PageProps {
  params: {
    workspaceId: string;
  };
}

export default async function WorkspaceConnectionsPage({ params }: PageProps) {
  const { workspaceId } = await params;
  const workspaces = await getWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  async function handleDeleteWorkspace() {
    "use server";
    await deleteWorkspace(workspaceId);
    redirect("/workspace");
  }

  async function handleUpdateName(newName: string) {
    "use server";
    console.log(`Updating workspace name to: ${newName}`);
  }

  return (
    <WorkspaceSettingsClient
      workspaceId={workspaceId}
      workspaceName={workspace?.name ?? "Untitled Workspace"}
      onUpdateName={handleUpdateName}
      onDeleteWorkspace={handleDeleteWorkspace}
    />
  );
}
