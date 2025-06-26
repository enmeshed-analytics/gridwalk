import "../globals.css";
import { getWorkspaces } from "./actions";
import { Sidebar } from "./components/sidebar";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const workspaces = await getWorkspaces();

  return (
    <div className={`h-full w-full flex`}>
      <Sidebar workspaces={workspaces} />
      <div className="flex-1 pt-6">{children}</div>
    </div>
  );
}
