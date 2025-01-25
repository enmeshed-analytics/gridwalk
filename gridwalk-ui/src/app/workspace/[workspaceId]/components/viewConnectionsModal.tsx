"use client";
import React, { useEffect, useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { ViewWorkspaceConnectionsModalProps } from "../types";
import {
  getWorkspaceConnections,
  type WorkspaceConnection,
} from "../actions/workspace/get_connections";

export const ViewWorkspaceConnectionsModal: React.FC<
  ViewWorkspaceConnectionsModalProps
> = ({ isOpen, onClose, workspaceId }) => {
  const [connections, setConnections] = useState<WorkspaceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchConnections = async () => {
        try {
          setLoading(true);
          setError(null);
          const fetchedConnections = await getWorkspaceConnections(workspaceId);
          setConnections(fetchedConnections);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch connections"
          );
        } finally {
          setLoading(false);
        }
      };

      fetchConnections();
    }
  }, [isOpen, workspaceId]);

  if (!isOpen) return null;

  const getConnectorTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "postgis":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Workspace Connections
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="py-4">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="animate-spin h-6 w-6 text-gray-500" />
            </div>
          ) : error ? (
            <div className="text-red-500 text-center py-4">{error}</div>
          ) : connections.length === 0 ? (
            <div className="text-gray-500 text-center py-4">
              No connections found
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Connection ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {connections.map((connection) => (
                    <tr key={connection.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Database className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {connection.id}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {connection.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getConnectorTypeColor(
                            connection.connector_type
                          )}`}
                        >
                          {connection.connector_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
