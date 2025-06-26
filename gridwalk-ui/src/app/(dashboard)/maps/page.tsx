import { getMaps } from "./actions";
import { getWorkspaces } from "../actions";
import MapClient from "./components/client";

interface PageParams {
  searchParams: Promise<{
    workspace?: string;
  }>;
}

export default async function WorkspaceMapsPage({ searchParams }: PageParams) {
  const workspaceId = (await searchParams).workspace;

  if (!workspaceId) {
    return (
      <div className="text-2xl text-center text-gray-100">
        Please select a workspace.
      </div>
    );
  }

  const workspaces = await getWorkspaces();
  const foundWorkspace = workspaces.find((w) => w.id === workspaceId);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Current Workspace:{" "}
          <span className="text-blue-500">
            {foundWorkspace?.name || "Workspace"}
          </span>
        </h1>
      </div>

      <div className="px-6 pb-6 mt-4">
        <div className="max-w-6xl">
          <MapClient
            workspaceId={workspaceId}
            initialMaps={await getMaps(workspaceId)}
            currentWorkspace={{
              id: workspaceId,
              name: foundWorkspace?.name || "Unknown Workspace",
            }}
          />
        </div>
      </div>
    </div>
  );
}
