import { redirect } from 'next/navigation';

// Redirect to the maps page for this workspace
export async function GET(request, { params }) {
  const { workspaceId } = params;
  redirect(`/workspace/${workspaceId}/maps`);
}
