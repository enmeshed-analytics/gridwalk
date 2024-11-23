"use client";
import React from "react";

interface ViewWorkspaceMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ViewWorkspaceMemberModal: React.FC<
  ViewWorkspaceMemberModalProps
> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            View Workspace Member
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Content will be added here in the future */}
        <div className="py-4">{/* Placeholder for future content */}</div>

        <div className="flex justify-end">
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
