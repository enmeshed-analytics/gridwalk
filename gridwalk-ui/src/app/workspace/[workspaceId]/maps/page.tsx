import WorkspaceMapClient from './components/client';
import { getWorkspaces } from '../actions';
import { getMaps } from './actions';

export default async function WorkspaceMapsPage({ params }) {
  const { workspaceId } = await params;
  const workspaces = await getWorkspaces();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  // Server-side data fetching
  const initialProjects = await getMaps(workspaceId);

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-6">
        <WorkspaceMapClient 
          workspaceId={workspaceId}
          initialProjects={initialProjects}
          currentWorkspace={{ id: workspaceId, name: workspace.name }}
        />
      </div>
    </div>
  );
}
