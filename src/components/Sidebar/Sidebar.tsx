"use client";
import React, { useCallback, useState } from "react";
import Clock from "./SidebarClock";
import {
  X,
  Layers,
  Upload,
  FileText,
  Trash2,
  Link,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import ConnectionsModal from "../Modals/ConnectionsModal";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLayerToggle: (layers: string[]) => void;
  onFileUpload: (file: File) => void;
  uploadError: string | null;
  onFileDelete: (fileName: string) => void;
  onFileToggle: (fileName: string, isActive: boolean) => void;
  activeLayers: string[];
  layerNames: string[];
  uploadedFiles: string[];
  activeFiles: string[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onLayerToggle,
  onFileUpload,
  uploadError,
  onFileDelete,
  onFileToggle,
  activeLayers,
  layerNames,
  uploadedFiles,
  activeFiles,
}) => {
  const isLayerActive = useCallback(
    (layer: string) => activeLayers.includes(layer),
    [activeLayers],
  );
  const isFileActive = useCallback(
    (file: string) => activeFiles.includes(file),
    [activeFiles],
  );
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);
  const [isLayerOptionsVisible, setIsLayerOptionsVisible] = useState(false);

  const handleCheckboxChange = (layerName: string) => {
    const updatedLayers = isLayerActive(layerName)
      ? activeLayers.filter((layer) => layer !== layerName)
      : [...activeLayers, layerName];
    onLayerToggle(updatedLayers);
  };

  const handleFileCheckboxChange = (fileName: string) => {
    onFileToggle(fileName, !isFileActive(fileName));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleFileDelete = (fileName: string) => {
    localStorage.removeItem(`file:${fileName}`);
    const storedFiles = JSON.parse(
      localStorage.getItem("uploadedFiles") || "[]",
    );
    const updatedFiles = storedFiles.filter(
      (name: string) => name !== fileName,
    );
    localStorage.setItem("uploadedFiles", JSON.stringify(updatedFiles));
    onFileDelete(fileName);
  };

  const toggleLayerOptions = () => {
    setIsLayerOptionsVisible(!isLayerOptionsVisible);
  };

  const SidebarContent: React.FC = () => (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            GridWalk
          </h1>
          <Clock />
        </div>
      </div>
      <div className="flex-1 px-6 py-4">
        <div className="mb-6">
          <button
            onClick={toggleLayerOptions}
            className="flex items-center text-lg font-semibold text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            {isLayerOptionsVisible ? (
              <ChevronDown className="mr-2 h-5 w-5" />
            ) : (
              <ChevronRight className="mr-2 h-5 w-5" />
            )}
            <Layers className="mr-2 h-5 w-5" />
            Layer Options
          </button>
          {isLayerOptionsVisible && (
            <div className="mt-4 ml-7">
              {layerNames.map((layerName) => (
                <div key={layerName} className="mb-4">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLayerActive(layerName)}
                      onChange={() => handleCheckboxChange(layerName)}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded transition duration-150 ease-in-out"
                    />
                    <span className="text-gray-700 dark:text-gray-300 capitalize">
                      {layerName}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4">
          <button
            onClick={() => setIsConnectionsModalOpen(true)}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Link className="mr-2 h-5 w-5" />
            Connections
          </button>
        </div>

        <div className="mt-8">
          <h2 className="flex items-center text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
            <Upload className="mr-2 h-5 w-5" />
            Upload GeoJSON File
          </h2>
          <label className="flex flex-col items-center px-4 py-6 bg-white dark:bg-gray-700 text-blue-600 rounded-lg shadow-lg tracking-wide uppercase border border-blue-600 cursor-pointer hover:bg-blue-600 hover:text-white transition duration-300 ease-in-out">
            <svg
              className="w-8 h-8"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z" />
            </svg>
            <span className="mt-2 text-sm leading-normal">
              Select a GeoJSON file (max 5MB)
            </span>
            <input
              type="file"
              accept=".json,.geojson"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          {uploadError && (
            <p className="mt-2 text-red-500 text-sm">{uploadError}</p>
          )}
        </div>
        <div className="mt-8">
          <h2 className="flex items-center text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
            <FileText className="mr-2 h-5 w-5" />
            Uploaded Layers
          </h2>
          {uploadedFiles.length > 0 ? (
            <ul className="space-y-2">
              {uploadedFiles.map((fileName, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between text-gray-700 dark:text-gray-300 space-x-2"
                >
                  <label className="flex items-center space-x-3 cursor-pointer flex-grow min-w-0">
                    <input
                      type="checkbox"
                      checked={isFileActive(fileName)}
                      onChange={() => handleFileCheckboxChange(fileName)}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded transition duration-150 ease-in-out"
                    />
                    <span className="truncate">{fileName}</span>
                  </label>
                  <button
                    onClick={() => handleFileDelete(fileName)}
                    className="text-red-500 hover:text-red-700 transition duration-150 ease-in-out z-30"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">
              No files uploaded yet.
            </p>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex flex-col w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-lg">
        <SidebarContent />
      </aside>
      <ConnectionsModal
        isOpen={isConnectionsModalOpen}
        onClose={() => setIsConnectionsModalOpen(false)}
      />

      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity duration-300 ease-in-out"
            onClick={onClose}
          ></div>
          <nav className="relative flex flex-col w-80 h-full bg-gray-50 dark:bg-gray-900 transform transition-all duration-300 ease-in-out">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                onClick={onClose}
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <SidebarContent />
          </nav>
        </div>
      )}
    </>
  );
};

export default Sidebar;