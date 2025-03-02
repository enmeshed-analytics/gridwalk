import React from "react";
import { ServerSidebar } from "./components/sidebar";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <ServerSidebar />
      <main className="flex-1 overflow-auto">
        <div className="flex items-center justify-end px-4 h-16 md:h-0">
        </div>
        {children}
      </main>
    </div>
  );
}
