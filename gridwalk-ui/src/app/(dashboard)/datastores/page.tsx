import WorkspaceConnectionsClient from "./components/client";
import { getWorkspaceConnections } from "./actions";

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

// Calculate relative time
export function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hr ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return formatDate(dateString);
}

interface PageParams {
  searchParams: Promise<{
    workspace?: string;
  }>;
}

export default async function WorkspaceConnectionsPage({ searchParams }: PageParams) {
  const workspaceId = (await searchParams).workspace;

  if (!workspaceId) {
    return <div className="text-2xl text-center text-gray-100">Please select a workspace.</div>;
  }

  // Fetch data server-side
  const connections = await getWorkspaceConnections(workspaceId);

  return (
    <WorkspaceConnectionsClient 
      workspaceId={workspaceId} 
      connections={connections} 
    />
  );
}
