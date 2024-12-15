"use client";
import React, { useState } from "react";
import {
  FolderKanban,
  Plus,
  HelpCircle,
  Users,
  Database,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateWorkspaceModal } from "./modal";
import { createWorkspace } from "./actions";
import { HelpSupportModal } from "./supportModal";
import { useWorkspaces } from "./workspaceContext";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
}

const StatCard = ({ title, value, icon: Icon, description }: StatCardProps) => (
  <div className="bg-white p-6 rounded-xl border border-gray-500 shadow-sm">
    {" "}
    {/* Changed border color */}
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
  const { workspaces } = useWorkspaces();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHelpSupportModalOpen, setIsHelpSupportModalOpen] = useState(false);

  // Mock data for now
  // TODO add in real data
  const currentPlan = "MVP";
  const totalProjects = 0; // Example count
  const totalConnections = 0; // Example count

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Header Section with Plan Info */}
        <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-xl border border-gray-500 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome to GridWalk
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-green-50 px-4 py-2 rounded-full">
              <span className="text-green-700 font-medium">{currentPlan}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Workspaces"
            value={workspaces.length}
            icon={FolderKanban}
            description="Active workspaces"
          />
          <StatCard
            title="Total Projects"
            value={totalProjects}
            icon={Database}
            description="Across all workspaces"
          />
          <StatCard
            title="Active Connections"
            value={totalConnections}
            icon={Users}
            description="Connected team members"
          />
        </div>

        {/* Workspaces List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-500 overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-black">
              Your Workspaces
            </h2>
          </div>
          <div className="p-6">
            {workspaces.length > 0 ? (
              <div className="grid gap-4 font-semibold text-black">
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-300"
                  >
                    <div className="flex items-center gap-4">
                      <FolderKanban className="w-5 h-5 text-blue-500" />
                      <div>
                        <h3 className="font-medium">{workspace.name}</h3>
                        <p className="text-sm text-black">
                          0 projects • 0 members
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FolderKanban className="w-12 h-12 text-gray-400 mx-auto mb-4" />
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

      {/* Help Button */}
      <div className="fixed bottom-0 right-0 p-6">
        <button
          onClick={() => setIsHelpSupportModalOpen(true)}
          className="bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group p-4"
          aria-label="Help and Support"
        >
          <HelpCircle className="w-6 h-6 text-blue-500 group-hover:text-blue-600" />
        </button>
      </div>

      {/* Modals */}
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
