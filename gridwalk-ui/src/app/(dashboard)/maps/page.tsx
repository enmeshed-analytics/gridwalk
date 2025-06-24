import { getWorkspaces } from "../actions";
import { getMaps } from "./actions";
import MapClient from "./components/client";

interface PageParams {
  searchParams: Promise<{
    workspace?: string;
  }>;
}

export default async function WorkspaceMapsPage({ searchParams }: PageParams) {
  const workspaceId = (await searchParams).workspace;

  if (!workspaceId) {
    return <div className="text-2xl text-center text-gray-100">Please select a workspace.</div>;
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-6">
        <MapClient
          workspaceId={workspaceId}
          initialMaps={await getMaps(workspaceId)}
          currentWorkspace={{ id: workspaceId, name: "" }} // Name will be set in the client
        />
      </div>
    </div>
  );
}
