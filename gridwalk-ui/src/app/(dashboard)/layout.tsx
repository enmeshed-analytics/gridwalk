import { cookies } from "next/headers";
import { redirect } from 'next/navigation';
import { Workspace } from "@/types";
import "../globals.css";
import { getWorkspaces } from "@/app/utils";

import { Sidebar } from './components/sidebar';


export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const workspaces = await getWorkspaces();

  return (
    <div className={`h-full w-full flex`}>
      <Sidebar workspaces={workspaces} />
      <div className="flex-1 pt-24 px-6 pb-6">
        { children }
      </div>
    </div>
  );
}
