"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Search, MoreHorizontal } from "lucide-react";
import { getRoleBadgeColor } from "../page";
import { removeWorkspaceMember as removeMember } from "../actions";
import AddMemberModal from "./add-member-modal";

interface WorkspaceMembersClientProps {
  workspaceId: string;
  members: WorkspaceMember[];
}

export default function WorkspaceMembersClient({ workspaceId, members }: WorkspaceMembersClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter members based on search query - only using email and role as per your data structure
  const filteredMembers = members.filter(member => 
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
                  <Label htmlFor="searchMembers" className="sr-only">Search members</Label>
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <Input
                    placeholder="Search members..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <AddMemberModal workspaceId={workspaceId} className="w-full sm:w-auto" />
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
                      <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th scope="col" className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Joined
                      </th>
                      <th scope="col" className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Active
                      </th>
                      <th scope="col" className="relative px-4 sm:px-6 py-3 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                    {filteredMembers.map((member) => (
                      <tr key={member.email}>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {member.email}
                          </div>
                          {/* Mobile-only date display */}
                          <div className="md:hidden text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Joined: Joined At Some Point
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
                          Last Active At Some Point
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
                                    if (confirm(`Are you sure you want to remove ${member.email}?`)) {
                                      removeMember(member.id, workspaceId);
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {filteredMembers.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No members found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
