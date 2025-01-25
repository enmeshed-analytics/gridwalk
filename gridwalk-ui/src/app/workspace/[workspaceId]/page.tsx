import { getProjects } from "./actions/projects/get";
import WorkspaceProjectsClient from "./workspaceProjectPage";

type PageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { workspaceId } = await params;
  const initialProjects = await getProjects(workspaceId);
  return (
    <WorkspaceProjectsClient
      workspaceId={workspaceId}
      initialProjects={initialProjects}
    />
  );
}
