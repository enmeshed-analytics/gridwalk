"use client";
import React, { useEffect, useState } from "react";
import { getWorkspaceMembers } from "./actions/workspace/get_members";
import { Shield, Mail, Loader2, X } from "lucide-react";
import { removeWorkspaceMember } from "./actions/workspace/remove_members";
import { useRouter } from "next/navigation";

interface ViewWorkspaceMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

type WorkspaceMember = {
  email: string;
  role: "Admin" | "Read";
};

export const ViewWorkspaceMemberModal: React.FC<
  ViewWorkspaceMemberModalProps
> = ({ isOpen, onClose, workspaceId }) => {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      const fetchMembers = async () => {
        try {
          setLoading(true);
          setError(null);
          const fetchedMembers = await getWorkspaceMembers(workspaceId);
          setMembers(fetchedMembers);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch members",
          );
        } finally {
          setLoading(false);
        }
      };

      fetchMembers();
    }
  }, [isOpen, workspaceId]);

  if (!isOpen) return null;

  const getRoleColor = (role: "Admin" | "Read") => {
    switch (role) {
      case "Admin":
        return "bg-blue-100 text-blue-800";
      case "Read":
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleRemoveMember = async (email: string) => {
    try {
      setRemoving(email);
      await removeWorkspaceMember({
        workspace_id: workspaceId,
        email: email,
      });
      setMembers(members.filter((member) => member.email !== email));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Workspace Members</h2>
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
          ) : members.length === 0 ? (
            <div className="text-gray-500 text-center py-4">
              No members found
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                      Remove
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((member, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {member.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 text-gray-400 mr-2" />
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(
                              member.role,
                            )}`}
                          >
                            {member.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleRemoveMember(member.email)}
                          disabled={removing === member.email}
                          className={`inline-flex items-center justify-center h-8 w-8 rounded-full
                            ${
                              removing === member.email
                                ? "bg-gray-100 cursor-not-allowed"
                                : "text-red-600 hover:bg-red-100 transition-colors"
                            }`}
                          title="Remove member"
                        >
                          {removing === member.email ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </button>
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
