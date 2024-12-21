"use client";
import React, { useState, useEffect } from "react";
import {
  FolderKanban,
  FolderCheck,
  MapIcon,
  Plus,
  HelpCircle,
  Users,
  LucideIcon,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateWorkspaceModal } from "./modal";
import { createWorkspace } from "./actions";
import { getProjects } from "@/app/workspace/[workspaceId]/actions/projects/get";
import { getWorkspaceMembers } from "@/app/workspace/[workspaceId]/actions/workspace/get_members";
import { HelpSupportModal } from "./supportModal";
import { useWorkspaces } from "./workspaceContext";

// Stat cards for the user
interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
}

// Workspace details
interface WorkspaceWithDetails {
  id: string;
  name: string;
  projectCount: number;
  memberCount: number;
  adminCount: number;
  readOnlyCount: number;
}

// Plan card value
// TODO need this to refelct the actual plans people will have
const currentPlan = "Private Beta";

// Create statcard
const StatCard = ({ title, value, icon: Icon, description }: StatCardProps) => (
  <div className="bg-white p-6 rounded-xl border border-gray-500 shadow-sm">
    <div className="flex items-center gap-4">
      <div className="bg-blue-50 p-3 rounded-lg">
        <Icon className="w-6 h-6 text-blue-500" />
      </div>
      <div>
        <p className="text-sm text-black">{title}</p>
        <h3 className="text-2xl font-semibold text-black">{value}</h3>
        {description && (
          <p className="text-xs text-black/70 mt-1">{description}</p>
        )}
      </div>
    </div>
  </div>
);

export default function WorkspacePage() {
  // Set state variables
  const { workspaces } = useWorkspaces();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHelpSupportModalOpen, setIsHelpSupportModalOpen] = useState(false);
  const [workspacesWithDetails, setWorkspacesWithDetails] = useState<
    WorkspaceWithDetails[]
  >([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch workspace and project data
  useEffect(() => {
    const fetchWorkspaceDetails = async () => {
      setLoading(true);
      try {
        const detailsPromises = workspaces.map(async (workspace) => {
          try {
            const [projects, members] = await Promise.all([
              getProjects(workspace.id),
              getWorkspaceMembers(workspace.id),
            ]);

            const adminCount = members.filter((m) => m.role === "Admin").length;
            const readOnlyCount = members.filter(
              (m) => m.role === "Read"
            ).length;

            return {
              id: workspace.id,
              name: workspace.name,
              projectCount: projects.length,
              memberCount: members.length,
              adminCount,
              readOnlyCount,
            };
          } catch (error) {
            console.error(
              `Failed to fetch details for workspace ${workspace.id}:`,
              error
            );
            return {
              id: workspace.id,
              name: workspace.name,
              projectCount: 0,
              memberCount: 0,
              adminCount: 0,
              readOnlyCount: 0,
            };
          }
        });

        const results = await Promise.all(detailsPromises);
        setWorkspacesWithDetails(results);

        const projectsTotal = results.reduce(
          (sum, workspace) => sum + workspace.projectCount,
          0
        );
        const membersTotal = results.reduce(
          (sum, workspace) => sum + workspace.memberCount,
          0
        );

        setTotalProjects(projectsTotal);
        setTotalMembers(membersTotal);
      } catch (error) {
        console.error("Failed to fetch workspace details:", error);
      } finally {
        setLoading(false);
      }
    };

    if (workspaces.length > 0) {
      fetchWorkspaceDetails();
    } else {
      setWorkspacesWithDetails([]);
      setTotalProjects(0);
      setTotalMembers(0);
      setLoading(false);
    }
  }, [workspaces]);

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-xl border border-gray-500 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome to GridWalk
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-purple-50 px-4 py-2 rounded-full">
              <span className="text-purple-700 font-medium">{currentPlan}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            title="Total Workspaces"
            value={workspaces.length}
            icon={FolderKanban}
            description="Active workspaces"
          />
          <StatCard
            title="Total Projects"
            value={totalProjects}
            icon={MapIcon}
            description="Across all workspaces"
          />
          <StatCard
            title="Active Members"
            value={totalMembers}
            icon={Users}
            description="All workspace members"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-500 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-black">
              Your Workspaces
            </h2>
          </div>
          <div className="p-2">
            {loading ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
                <p className="text-gray-500">Loading workspace details...</p>
              </div>
            ) : workspacesWithDetails.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {workspacesWithDetails.map((workspace) => (
                  <div
                    key={workspace.id}
                    className="p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FolderCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm text-gray-900 truncate">
                          {workspace.name}
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {workspace.projectCount} projects •{" "}
                          {workspace.memberCount} members •{" "}
                          {workspace.adminCount} admins •{" "}
                          {workspace.readOnlyCount} viewers
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FolderCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No workspaces yet
                </h3>
                <p className="text-gray-500 mb-4">
                  Create your first workspace to get started
                </p>
                <Button onClick={() => setIsModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workspace
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 right-0 p-6">
        <button
          onClick={() => setIsHelpSupportModalOpen(true)}
          className="bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group p-4"
          aria-label="Help and Support"
        >
          <HelpCircle className="w-6 h-6 text-blue-500 group-hover:text-blue-600" />
        </button>
      </div>

      <CreateWorkspaceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={createWorkspace}
      />
      <HelpSupportModal
        isOpen={isHelpSupportModalOpen}
        onClose={() => setIsHelpSupportModalOpen(false)}
      />
    </div>
  );
}
