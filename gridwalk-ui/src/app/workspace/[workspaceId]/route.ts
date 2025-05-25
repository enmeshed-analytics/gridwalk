import { redirect } from "next/navigation";

interface RouteParams {
  params: { workspaceId: string };
}

// Redirect to the maps page for this workspace
export async function GET(request: Request, { params }: RouteParams) {
  const { workspaceId } = params;
  redirect(`/workspace/${workspaceId}/maps`);
}
