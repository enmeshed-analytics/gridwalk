import WorkspaceMapClient from "./components/client";
import { getWorkspaces } from "../actions";
import { getMaps } from "./actions";

interface PageParams {
  params: { workspaceId: string };
}

export default async function WorkspaceMapsPage({ params }: PageParams) {
  const { workspaceId } = await params;
  const workspaces = await getWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) throw new Error("Workspace not found");
  // Server-side data fetching
  const initialMaps = await getMaps(workspaceId);

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-6">
        <WorkspaceMapClient
          workspaceId={workspaceId}
          initialMaps={initialMaps}
          currentWorkspace={{ id: workspaceId, name: workspace.name }}
        />
      </div>
    </div>
  );
}
