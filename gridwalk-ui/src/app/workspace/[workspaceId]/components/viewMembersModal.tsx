"use client";
import React, { useEffect, useState } from "react";
import { getWorkspaceMembers } from "../actions/workspace/get_members";
import { Shield, Mail, Loader2, X } from "lucide-react";
import { removeWorkspaceMember } from "../actions/workspace/remove_members";
import { useRouter } from "next/navigation";
import { ViewWorkspaceMemberModalProps } from "../types";

// TODO create a delete confirmation modal that can be reused for other modals
type WorkspaceMember = {
  email: string;
  role: "Admin" | "Read";
};

const role_colors = {
  Admin: "bg-blue-100 text-blue-800",
  Read: "bg-gray-100 text-gray-800",
} as const;

export function ViewWorkspaceMemberModal({
  isOpen,
  onClose,
  workspaceId,
}: ViewWorkspaceMemberModalProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [memberToDelete, setMemberToDelete] = useState<WorkspaceMember | null>(
    null
  );
  const router = useRouter();

  // When modal is opened, fetch members
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
            err instanceof Error
              ? err.message
              : "Failed to fetch workspace members"
          );
        } finally {
          setLoading(false);
        }
      };

      fetchMembers();
    }
  }, [isOpen, workspaceId]);

  const handleRemoveMember = async (member: WorkspaceMember) => {
    setMemberToDelete(member);
    setConfirmText("");
  };

  const confirmRemoveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToDelete || confirmText !== "DELETE") return;

    try {
      setRemoving(memberToDelete.email);
      await removeWorkspaceMember({
        workspace_id: workspaceId,
        email: memberToDelete.email,
      });
      setMembers(
        members.filter((member) => member.email !== memberToDelete.email)
      );
      router.refresh();
      setMemberToDelete(null);
      setConfirmText("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove workspace member"
      );
    } finally {
      setRemoving(null);
    }
  };

  if (!isOpen) return null;

  // Delete confirmation modal
  // TODO move to a seperate component that can be reused for other modals
  const DeleteConfirmation = () => {
    if (!memberToDelete) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Remove Member</h2>
            <button
              onClick={() => setMemberToDelete(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              Are you sure you want to remove{" "}
              <span className="font-semibold">{memberToDelete.email}</span>?
            </p>
            <p className="text-gray-600 text-sm mb-4">
              This action cannot be undone. The member will lose access to this
              workspace.
            </p>
            <p className="text-gray-700 text-sm mb-2">
              Type <span className="font-mono font-bold">DELETE</span> to
              confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Enter text..."
              disabled={removing === memberToDelete.email}
            />
          </div>

          <form onSubmit={confirmRemoveMember}>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={removing === memberToDelete.email}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  removing === memberToDelete.email || confirmText !== "DELETE"
                }
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {removing === memberToDelete.email ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4" />
                    Removing...
                  </>
                ) : (
                  "Remove Member"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Workspace Members
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
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                role_colors[member.role]
                              }`}
                            >
                              {member.role}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleRemoveMember(member)}
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
      <DeleteConfirmation />
    </>
  );
}
