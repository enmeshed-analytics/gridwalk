import { getProjectsServer } from "./actions";
import WorkspaceProjectsClient from "./workspaceProjects";

export default async function Page({
  params,
}: {
  params: { workspaceId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { workspaceId } = await params;

  const initialProjects = await getProjectsServer(workspaceId);

  return (
    <WorkspaceProjectsClient
      workspaceId={workspaceId}
      initialProjects={initialProjects}
    />
  );
}
