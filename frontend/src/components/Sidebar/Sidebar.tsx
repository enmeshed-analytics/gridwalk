import React, { useState } from "react";
import Clock from "./SidebarClock";
import {
  X,
  Layers,
  Upload,
  FileText,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { layerIcons } from "./sidebarHandler";

type LayerGroup = {
  title: string;
  layers: string[];
  onLayerSelect?: (layerName: string) => void;
};

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  onLayerToggle: (updatedLayers: string[]) => void;
  onFileUpload: (file: File) => void;
  onFileDelete: (fileName: string) => void;
  onFileToggle: (fileName: string, isActive: boolean) => void;
  activeLayers: string[];
  uploadedFiles: string[];
  activeFiles: string[];
  uploadError: string | null;
  selectedBaseLayer: string;
  layerGroups: LayerGroup[];
};

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  onLayerToggle,
  onFileUpload,
  onFileDelete,
  onFileToggle,
  activeLayers,
  uploadedFiles,
  activeFiles,
  uploadError,
  selectedBaseLayer,
  layerGroups,
}) => {
  const [visibleGroups, setVisibleGroups] = useState<Record<string, boolean>>({});

  const toggleGroupVisibility = (title: string) => {
    setVisibleGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const isLayerActive = (layer: string) => activeLayers.includes(layer);
  const isFileActive = (file: string) => activeFiles.includes(file);

  const handleCheckboxChange = (layerName: string) => {
    const updatedLayers = isLayerActive(layerName)
      ? activeLayers.filter((layer) => layer !== layerName)
      : [...activeLayers, layerName];
    onLayerToggle(updatedLayers);
  };

  const handleFileCheckboxChange = (fileName: string) => {
    onFileToggle(fileName, !isFileActive(fileName));
  };

  const handleFileUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const renderLayerGroup = ({ title, layers, onLayerSelect }: LayerGroup) => {
    const LayerIcon = layerIcons[title.replace(/\s+/g, "")] || Layers;
    const isVisible = visibleGroups[title];

    return (
      <div key={title} className="mb-6">
        <button
          onClick={() => toggleGroupVisibility(title)}
          className="flex items-center text-lg font-semibold text-gray-700 dark:text-gray-200 focus:outline-none"
        >
          {isVisible ? (
            <ChevronDown className="mr-2 h-5 w-5" />
          ) : (
            <ChevronRight className="mr-2 h-5 w-5" />
          )}
          <LayerIcon className="mr-2 h-5 w-5" />
          {title}
        </button>
        {isVisible && (
          <div className="mt-4 ml-7">
            {layers.map((layerName) => {
              const LayerItemIcon = layerIcons[layerName] || Layers;
              return (
                <div key={layerName} className="mb-4">
                  {onLayerSelect ? (
                    <button
                      onClick={() => onLayerSelect(layerName)}
                      className={`w-full mb-2 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        layerName === selectedBaseLayer ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                      }`}
                    >
                      <LayerItemIcon className="mr-2 h-5 w-5" />
                      {layerName}
                    </button>
                  ) : (
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isLayerActive(layerName)}
                        onChange={() => handleCheckboxChange(layerName)}
                        className="form-checkbox h-5 w-5 text-blue-600 rounded transition duration-150 ease-in-out"
                      />
                      <LayerItemIcon className="mr-2 h-5 w-5" />
                      <span className="text-gray-700 dark:text-gray-300 capitalize">
                        {layerName}
                      </span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const SidebarContent = () => (
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
        {layerGroups.map(renderLayerGroup)}
        
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
              onChange={handleFileUploadChange}
            />
          </label>
          {uploadError && (
            <p className="mt-2 text-red-500 text-sm">{uploadError}</p>
          )}
        </div>
        <div className="mt-8">
          <h2 className="flex items-center text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">
            <FileText className="mr-2 h-5 w-5" />
            Local Layers
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
                    onClick={() => onFileDelete(fileName)}
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
      <aside className={`${isOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-gray-800 overflow-y-auto transition-transform duration-300 ease-in-out md:relative md:translate-x-0`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 md:hidden"
        >
          <X className="h-6 w-6" />
        </button>
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
