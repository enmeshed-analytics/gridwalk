"use client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfileData, Workspace } from "../actions";
import { ClientWorkspaceDropdown } from "./workspace-dropdown";
import { ClientProfileSection } from "./profile-section";
import { Button } from "@/components/ui/button";
import { Map, Users, Link2, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface ClientSidebarContentProps {
  profileData: ProfileData;
  workspaces: Workspace[];
}

export function ClientSidebarContent({
  profileData,
  workspaces,
}: ClientSidebarContentProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeWorkspaceId =
    pathname?.split("/")[2] ||
    (workspaces.length > 0 ? workspaces[0].id : null);

  // Function to check if a link is currently active
  const isActivePath = (path: string) => {
    return pathname === path || pathname?.startsWith(path + "/");
  };

  // Common class names
  const baseButtonClasses = "w-full justify-start";
  const activeButtonClasses =
    "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium";
  const inactiveButtonClasses =
    "text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400";
  const activeIconClasses = "text-blue-600 dark:text-blue-400";

  // Helper function to get button class names
  const getButtonClasses = (path: string) => {
    return `${baseButtonClasses} ${
      isActivePath(path) ? activeButtonClasses : inactiveButtonClasses
    }`;
  };

  // Helper function to get icon class names
  const getIconClasses = (path: string) => {
    return `mr-2 h-4 w-4 ${isActivePath(path) ? activeIconClasses : ""}`;
  };

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="py-2">
          <ClientWorkspaceDropdown workspaces={workspaces} />
          {activeWorkspaceId && (
            <nav className="mt-6 px-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 mb-2">
                Workspace Navigation
              </h3>
              <div className="space-y-1">
                <Link
                  href={`/maps?workspace=${activeWorkspaceId}`}
                  className="block"
                >
                  <Button
                    variant="ghost"
                    className={getButtonClasses(
                      `/maps`
                    )}
                  >
                    <Map
                      className={getIconClasses(
                        `/maps`
                      )}
                    />
                    Maps
                  </Button>
                </Link>

                <Link
                  href={`/members?workspace=${activeWorkspaceId}`}
                  className="block"
                >
                  <Button
                    variant="ghost"
                    className={getButtonClasses(
                      `/members`
                    )}
                  >
                    <Users
                      className={getIconClasses(
                        `/members`
                      )}
                    />
                    Members
                  </Button>
                </Link>

                <Link
                  href={`/datastores?workspace=${activeWorkspaceId}`}
                  className="block"
                >
                  <Button
                    variant="ghost"
                    className={getButtonClasses(
                      `/connections`
                    )}
                  >
                    <Link2
                      className={getIconClasses(
                        `/connections`
                      )}
                    />
                    Data Stores
                  </Button>
                </Link>

                <Link
                  href={`/settings?workspace=${activeWorkspaceId}`}
                  className="block"
                >
                  <Button
                    variant="ghost"
                    className={getButtonClasses(
                      `/settings`
                    )}
                  >
                    <Settings
                      className={getIconClasses(
                        `/settings`
                      )}
                    />
                    Settings
                  </Button>
                </Link>
              </div>
            </nav>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="space-y-3">
          <ClientProfileSection profileData={profileData} />
        </div>
      </div>
    </div>
  );
}
