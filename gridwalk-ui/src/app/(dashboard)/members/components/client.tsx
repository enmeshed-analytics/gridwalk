"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Search, MoreHorizontal } from "lucide-react";
import { getRoleBadgeColor } from "../page";
import { removeWorkspaceMember as removeMember } from "../actions";
import AddMemberModal from "./add-member-modal";
import { useActivityTracker } from "@/hooks/use-activity-tracker";

interface WorkspaceMember {
  email: string;
  role: string;
  lastActive?: Date;
}

interface WorkspaceMembersClientProps {
  workspaceId: string;
  members: WorkspaceMember[];
  currentUserEmail: string;
}

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Active now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Helper function to get activity status from localStorage
// TODO:Will need to be a server side action when switched to backend
function getLastActiveFromStorage(email: string): Date | null {
  try {
    const stored = localStorage.getItem(`activity-${email}`);
    if (stored) {
      const data = JSON.parse(stored);
      return new Date(data.lastActive);
    }
  } catch (error) {
    console.error("Failed to get activity for", email, error);
  }
  return null;
}

export default function WorkspaceMembersClient({
  workspaceId,
  members,
  currentUserEmail,
}: WorkspaceMembersClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [memberActivities, setMemberActivities] = useState<
    Record<string, Date>
  >({});

  // Track current user's activity
  const currentUserActivity = useActivityTracker(currentUserEmail);

  // Load all member activities from localStorage
  useEffect(() => {
    const activities: Record<string, Date> = {};

    members.forEach((member) => {
      const lastActive = getLastActiveFromStorage(member.email);
      if (lastActive) {
        activities[member.email] = lastActive;
      }
    });

    setMemberActivities(activities);
  }, [members]);

  // Update current user's activity in the activities state
  useEffect(() => {
    setMemberActivities((prev) => ({
      ...prev,
      [currentUserEmail]: currentUserActivity,
    }));
  }, [currentUserEmail, currentUserActivity]);

  // Filter members based on search query - only using email and role as per your data structure
  const filteredMembers = members.filter(
    (member) =>
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 sm:p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
              <div>
                <CardTitle>Workspace Members</CardTitle>
                <CardDescription>
                  Manage members and their access to this workspace.
                </CardDescription>
              </div>
              <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                  <Label htmlFor="searchMembers" className="sr-only">
                    Search members
                  </Label>
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <Input
                    placeholder="Search members..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <AddMemberModal
                    workspaceId={workspaceId}
                    className="w-full sm:w-auto"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="border rounded-md">
                <table className="w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Email
                      </th>
                      <th
                        scope="col"
                        className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Role
                      </th>
                      <th
                        scope="col"
                        className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Joined
                      </th>
                      <th
                        scope="col"
                        className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Last Active
                      </th>
                      <th
                        scope="col"
                        className="relative px-4 sm:px-6 py-3 text-right"
                      >
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                    {filteredMembers.map((member) => {
                      const lastActive = memberActivities[member.email];
                      const isCurrentUser = member.email === currentUserEmail;

                      return (
                        <tr key={member.email}>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {member.email}
                              {isCurrentUser && (
                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900 dark:text-green-200 text-white font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            {/* Mobile-only date display */}
                            <div className="md:hidden text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {lastActive
                                ? `Active: ${formatRelativeTime(lastActive)}`
                                : "Activity unknown"}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <Badge className={getRoleBadgeColor(member.role)}>
                              {member.role}
                            </Badge>
                          </td>
                          <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            Joined At Some Point
                          </td>
                          <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {lastActive ? (
                              <div className="flex items-center space-x-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    isCurrentUser ||
                                    (lastActive &&
                                      new Date().getTime() -
                                        lastActive.getTime() <
                                        5 * 60 * 1000)
                                      ? "bg-green-400"
                                      : "bg-gray-400"
                                  }`}
                                />
                                <span>{formatRelativeTime(lastActive)}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">Unknown</span>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <button className="w-full text-left cursor-pointer">
                                    Reset Password
                                  </button>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <button
                                    className="w-full text-left cursor-pointer text-red-600 dark:text-red-400"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `Are you sure you want to remove ${member.email}?`
                                        )
                                      ) {
                                        removeMember({
                                          workspace_id: workspaceId,
                                          email: member.email,
                                        });
                                      }
                                    }}
                                  >
                                    Remove Member
                                  </button>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredMembers.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  No members found
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
