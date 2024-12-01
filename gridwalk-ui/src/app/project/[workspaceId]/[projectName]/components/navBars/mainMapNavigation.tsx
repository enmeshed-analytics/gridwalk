"use client";
import React from "react";
import {
  Map,
  Layers,
  Settings,
  Info,
  File,
  X,
  Upload,
  ArrowLeft,
} from "lucide-react";
import { ModalProps, MainMapNav } from "./types";
import { useRouter } from "next/navigation";

const LoadingDots = () => (
  <div className="flex gap-1">
    <div className="h-2 w-2 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_infinite]"></div>
    <div className="h-2 w-2 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_0.2s_infinite]"></div>
    <div className="h-2 w-2 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_0.4s_infinite]"></div>
  </div>
);

const MapModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onNavItemClick,
  selectedItem,
  onLayerUpload,
  isUploading,
  error,
}) => {
  const router = useRouter();

  const MainMapNavs: MainMapNav[] = [
    {
      id: "map",
      title: "Map Settings",
      icon: "map",
      description: "Configure map display options",
    },
    {
      id: "layers",
      title: "Layers",
      icon: "layers",
      description: "Manage map layers",
    },
    {
      id: "upload",
      title: "File Upload",
      icon: "file",
      description:
        "Upload files and add a layer to the map. Currently accepts .geojson, .json, and .gpkg files.",
    },
    {
      id: "settings",
      title: "Settings",
      icon: "settings",
      description: "Application settings",
    },
    {
      id: "about",
      title: "About",
      icon: "info",
      description: "About this application",
    },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onLayerUpload(file);
    }
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "map":
        return <Map className="w-5 h-5" />;
      case "layers":
        return <Layers className="w-5 h-5" />;
      case "file":
        return <File className="w-5 h-5" />;
      case "settings":
        return <Settings className="w-5 h-5" />;
      case "info":
        return <Info className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const renderModalContent = () => {
    if (!selectedItem) return null;

    switch (selectedItem.id) {
      case "upload":
        return (
          <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Upload</h2>

            {/* Upload Section */}
            <div className="mb-6">
              <label className="flex flex-col items-center px-4 py-6 bg-white rounded-lg shadow-lg border-2 border-dashed border-gray-300 hover:border-blue-400 cursor-pointer transition-colors">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">
                  Click to upload a file
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".geojson,.json,.gpkg"
                  disabled={isUploading}
                />
              </label>
            </div>

            {/* Status Messages */}
            {isUploading && (
              <div className="flex items-center justify-center space-x-2 text-blue-500 mb-4">
                <LoadingDots />
                <span className="ml-2">Uploading file</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md flex items-start">
                <span className="text-red-500 mr-2">❌</span>
                <span>{error}</span>
              </div>
            )}
          </div>
        );
      default:
        return (
          <div>
            <h2 className="text-xl font-bold mb-4">{selectedItem.title}</h2>
            <p className="text-gray-600">{selectedItem.description}</p>
          </div>
        );
    }
  };

  return (
    <>
      {/* Navigation Bar */}
      <div className="fixed left-0 top-0 h-full w-10 bg-gray-800 shadow-lg z-10 flex flex-col items-center py-6 rounded-r-lg">
        {/* GW Text at top */}
        <div className="py-4 text-gray-300 font-bold">GW</div>
        {/* Separator line */}
        <div className="w-8 h-px bg-gray-600 mb-4"></div>
        {/* Navigation Items */}
        {MainMapNavs.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavItemClick(item)}
            className={`
              w-10 h-8 mb-4 flex items-center justify-center rounded-lg
              transition-colors group relative
              ${
                selectedItem?.id === item.id
                  ? "bg-blue-400 text-white"
                  : "text-gray-300 hover:bg-blue-400 hover:text-white"
              }
            `}
            aria-label={item.title}
          >
            {getIconComponent(item.icon || "")}
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {item.title}
            </span>
          </button>
        ))}

        {/* Back Button */}
        <div className="mt-auto mb-6">
          <button
            onClick={() => router.push("/workspace")}
            className="w-10 h-8 flex items-center justify-center text-white bg-blue-700 hover:text-white hover:bg-blue-800 group relative"
            aria-label="Back to workspace"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Back to Workspaces
            </span>
          </button>
        </div>
      </div>

      {/* Modal Content */}
      {isOpen && selectedItem && (
        <div
          className="fixed left-12 z-50"
          style={{
            top: `${MainMapNavs.findIndex((item) => item.id === selectedItem.id) * 32 + 96}px`,
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-sm relative">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-2 top-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5 text-black" />
            </button>
            {/* Content with black text override */}
            <div className="max-h-[50vh] overflow-y-auto p-4">
              <div className="text-gray-900">{renderModalContent()}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MapModal;
