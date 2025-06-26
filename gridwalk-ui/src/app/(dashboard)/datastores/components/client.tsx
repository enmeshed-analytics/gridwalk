"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkspaceConnection } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Database } from "lucide-react";
import AddConnectionModal from "./add-connection-modal";

interface WorkspaceConnectionsClientProps {
  workspaceId: string;
  connections: WorkspaceConnection[];
}

// Helper function to get appropriate badge color based on connector type
const getConnectorBadgeColor = (connectorType: string) => {
  switch (connectorType.toLowerCase()) {
    case "postgis":
      return "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
    case "s3":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  }
};

export default function WorkspaceConnectionsClient({
  workspaceId,
  connections,
}: WorkspaceConnectionsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter connections based on search query
  const filteredConnections = connections.filter(
    (connection) =>
      connection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      connection.connector_type
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 sm:p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
              <div>
                <CardTitle>Workspace Connections</CardTitle>
                <CardDescription>
                  Manage data stores for this workspace to store vector and
                  raster data.
                </CardDescription>
              </div>
              <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 w-full md:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <Input
                    placeholder="Search connections..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <style jsx>{`
                    div :global(.add-connection-button) {
                      width: 100%;
                    }
                    @media (min-width: 640px) {
                      div :global(.add-connection-button) {
                        width: auto;
                      }
                    }
                  `}</style>
                  <AddConnectionModal workspaceId={workspaceId} />
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
                        Name
                      </th>
                      <th
                        scope="col"
                        className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Connector Type
                      </th>
                      <th
                        scope="col"
                        className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Status
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
                    {filteredConnections.map((connection) => (
                      <tr key={connection.id}>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {connection.connector_type.toLowerCase() ===
                              "postgis" && (
                              <Database className="h-4 w-4 mr-2 text-green-600" />
                            )}
                            <div>
                              <div className="text-sm text-gray-900 dark:text-white">
                                {connection.name}
                              </div>
                              {/* Mobile-only type and status display */}
                              <div className="sm:hidden flex items-center space-x-2 mt-1">
                                <Badge
                                  className={`text-xs ${getConnectorBadgeColor(
                                    connection.connector_type
                                  )}`}
                                >
                                  {connection.connector_type}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                                >
                                  Connected
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                          <Badge
                            className={getConnectorBadgeColor(
                              connection.connector_type
                            )}
                          >
                            {connection.connector_type}
                          </Badge>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                          >
                            Connected
                          </Badge>
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
                                  Edit Connection
                                </button>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <button className="w-full text-left cursor-pointer">
                                  Test Connection
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

            {filteredConnections.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  No connections found
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
