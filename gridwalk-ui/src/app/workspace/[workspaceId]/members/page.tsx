import WorkspaceMembersClient from "./components/client";
import { getWorkspaceMembers } from "./actions";
import { getProfile } from "../actions";

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
      return "bg-blue-100 text-white dark:bg-blue-900/50 dark:text-white";
    case "editor":
      return "bg-green-100 text-white dark:bg-green-900/50 dark:text-white";
    case "viewer":
      return "bg-gray-100 text-white dark:bg-gray-800 dark:text-white";
    default:
      return "bg-gray-100 text-white dark:bg-gray-800 dark:text-white";
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
  const [members, profile] = await Promise.all([
    getWorkspaceMembers(workspaceId),
    getProfile(),
  ]);

  return (
    <WorkspaceMembersClient
      workspaceId={workspaceId}
      members={members}
      currentUserEmail={profile.email}
    />
  );
}
