import { getProjectsServer } from "./actions";
import WorkspaceProjectsClient from "./workspaceProjects";

type PageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { workspaceId } = await params;
  const initialProjects = await getProjectsServer(workspaceId);
  return (
    <WorkspaceProjectsClient
      workspaceId={workspaceId}
      initialProjects={initialProjects}
    />
  );
}
