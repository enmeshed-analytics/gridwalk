import WorkspaceMembersClient from "./components/client";
import { getWorkspaceMembers } from "./actions";

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// Get badge color based on role
export function getRoleBadgeColor(role: string) {
  switch (role.toLowerCase()) {
    case "admin":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300";
    case "editor":
      return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300";
    case "viewer":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

// Calculate relative time
export function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hr ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)} days ago`;

  return formatDate(dateString);
}

interface PageProps {
  params: {
    workspaceId: string;
  };
}

export default async function WorkspaceMembersPage({ params }: PageProps) {
  const { workspaceId } = await params;

  // Fetch data server-side
  const members = await getWorkspaceMembers(workspaceId);

  return <WorkspaceMembersClient workspaceId={workspaceId} members={members} />;
}
