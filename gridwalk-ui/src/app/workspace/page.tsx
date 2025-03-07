import { redirect } from "next/navigation";
import { getWorkspaces } from "@/app/workspace/[workspaceId]/actions";

// Workspace path without ID, redirect to first workspace
export default async function WorkspacePage() {
  const workspaces = await getWorkspaces();
  const workspaceId = workspaces[0].id;

  redirect(`/workspace/${workspaceId}/maps`);

  // This code won't be reached due to the redirect
  return <></>;
}
