import { redirect } from 'next/navigation';

// Workspace with ID in path, redirect to maps page for that workspace
export default async function WorkspaceIdPage({ params }) {
  const { workspaceId } = await params;

  redirect(`/workspace/${workspaceId}/maps`);

  // This code won't be reached due to the redirect
  return (
    <></>
  );
}
