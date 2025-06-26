import WorkspaceSettingsClient from "./components/client";
import { getWorkspaces } from "../actions";
import { deleteWorkspace } from "./actions";

interface PageParams {
  searchParams: Promise<{
    workspace?: string;
  }>;
}

export default async function WorkspaceSettingsPage({
  searchParams,
}: PageParams) {
  const workspaceId = (await searchParams).workspace;
  const workspaces = await getWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);

  if (!workspaceId) {
    return (
      <div className="text-2xl text-center text-gray-100">
        Please select a workspace.
      </div>
    );
  }

  async function handleDeleteWorkspace() {
    "use server";
    if (!workspaceId) {
      throw new Error("Workspace ID is required");
    }
    await deleteWorkspace(workspaceId);
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
