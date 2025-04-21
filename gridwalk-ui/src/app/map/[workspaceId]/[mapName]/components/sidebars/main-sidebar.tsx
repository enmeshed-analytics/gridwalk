"use client";
import React from "react";
import { Layers, File, X, Upload, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MainSidebarProps,
  MainSidebarModalOptions,
  WorkspaceConnection,
} from "./types";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";

// Loading dots for file upload
const LoadingDots = () => (
  <div className="flex gap-0.5">
    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_infinite]"></div>
    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_0.2s_infinite]"></div>
    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_0.4s_infinite]"></div>
  </div>
);

// Table for the available layers
interface LayersTableProps {
  connections: WorkspaceConnection[];
  mapRef: React.RefObject<maplibregl.Map | null>;
  selectedLayers: { [key: number]: boolean };
  onLayerToggle: (index: number, connection: WorkspaceConnection) => void;
  onStyleClick: (layerId: string) => void;
  workspaceId: string;
}

const LayersTable = ({
  connections,
  selectedLayers,
  onLayerToggle,
  onStyleClick,
  workspaceId,
}: LayersTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <tbody>
          {connections.map((connection, index) => (
            <tr
              key={index}
              className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <td className="px-4 py-2 text-xs text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-4">
                  <span className="flex-1 truncate">{String(connection)}</span>
                  <div className="flex gap-2 shrink-0">
                    {selectedLayers[index] && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onStyleClick(`layer-${workspaceId}-${connection}`)
                        }
                        className="px-3 py-0.5 text-xs h-6 min-h-0 text-white bg-blue-500 dark:bg-blue-600 border-none hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors"
                      >
                        Style
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onLayerToggle(index, connection)}
                      className={`px-3 py-0.5 text-xs h-6 min-h-0 transition-colors ${
                        selectedLayers[index]
                          ? "text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                          : "dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {selectedLayers[index] ? "Active" : "Select"}
                    </Button>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Modals for uploading files, viewing layers etc
const MainSidebar = ({
  isOpen,
  onClose,
  onItemClick,
  selectedItem,
  onLayerUpload,
  isUploading,
  error,
  uploadSuccess,
  uploadProgress,
  selectedFile,
  fileName,
  onFileSelection,
  onFileNameChange,
  onCancelSelection,
  workspaceConnections,
  mapRef,
  selectedLayers,
  onLayerToggle,
  onStyleClick,
  workspaceId,
}: MainSidebarProps) => {
  const router = useRouter();
  const [uploadKey, setUploadKey] = React.useState(0);

  React.useEffect(() => {
    if (uploadSuccess) {
      setUploadKey((prev) => prev + 1);
    }
  }, [uploadSuccess]);

  const MainSidebarModalOptions: MainSidebarModalOptions[] = [
    {
      id: "layers",
      title: "Layers",
      icon: "layers",
      description: "Visualise available map layers",
    },
    {
      id: "upload",
      title: "File Upload",
      icon: "file",
      description: "Upload files and add a layer to the map.",
    },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelection(file);
    }
  };

  const handleUploadClick = () => {
    if (selectedFile) {
      onLayerUpload(selectedFile);
    }
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "layers":
        return <Layers className="w-5 h-5" />;
      case "file":
        return <File className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const renderModalContent = () => {
    if (!selectedItem) return null;

    switch (selectedItem.id) {
      case "layers":
        return (
          <div className="p-1">
            <h2 className="text-l font-bold mb-4 text-blue-500 dark:text-blue-400">
              Public Layers
            </h2>
            {workspaceConnections?.length > 0 ? (
              <div className="mb-3">
                <LayersTable
                  connections={workspaceConnections}
                  mapRef={mapRef}
                  selectedLayers={selectedLayers}
                  onLayerToggle={onLayerToggle}
                  onStyleClick={onStyleClick}
                  workspaceId={workspaceId}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No layers available.
              </p>
            )}
          </div>
        );

      case "upload":
        return (
          <div className="p-2">
            <h2 className="text-l font-bold mb-4 text-blue-500 dark:text-blue-400">
              File Upload
            </h2>

            {/* Upload Section */}
            {!selectedFile ? (
              <div className="mb-6">
                <label
                  key={uploadKey}
                  className="flex flex-col items-center px-4 py-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-gray-400 dark:text-gray-500 mb-2" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Click to upload a file
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".geojson,.json,.gpkg,.parquet,.xlsx,.csv,.zip"
                    disabled={isUploading}
                  />
                </label>
              </div>
            ) : (
              <div className="mb-4 space-y-2">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    Selected file: {selectedFile.name}
                  </p>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                      Enter layer name:
                    </label>
                    <input
                      type="text"
                      value={fileName}
                      onChange={(e) => onFileNameChange(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Enter layer name"
                    />

                    {/* Public/Private Toggle with reduced spacing */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Visibility:
                      </span>
                      <button
                        type="button"
                        className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-blue-500 bg-green-500 dark:bg-green-600"
                        role="switch"
                        aria-checked="true"
                      >
                        <span className="sr-only">Use setting</span>
                        <span className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-4" />
                      </button>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Public
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleUploadClick}
                      disabled={!fileName.trim() || isUploading}
                      className="px-3 py-1 text-xs bg-blue-500 dark:bg-blue-600 text-white rounded-md hover:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Upload
                    </button>
                    <button
                      onClick={onCancelSelection}
                      className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isUploading && (
              <div className="flex items-center justify-center space-x-1 text-blue-500 dark:text-blue-400 mb-2 text-xs">
                <LoadingDots />
                <span className="ml-1">Uploading ({uploadProgress}%)</span>
              </div>
            )}

            {uploadSuccess && !isUploading && (
              <div className="mb-2 p-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex items-center text-xs border border-green-200 dark:border-green-800">
                <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400 mr-1" />
                <span>Upload complete!</span>
              </div>
            )}

            {error && (
              <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md flex items-center text-xs border border-red-200 dark:border-red-800">
                <span className="text-red-500 dark:text-red-400 mr-1">❌</span>
                <span>{error}</span>
              </div>
            )}
          </div>
        );
      default:
        return (
          <div>
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              {selectedItem.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {selectedItem.description}
            </p>
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
        {MainSidebarModalOptions.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
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
              {item.description && (
                <span className="block text-xs text-gray-300 mt-0.5">
                  {item.description}
                </span>
              )}
            </span>
          </button>
        ))}

        {/* Back Button */}
        <div className="mt-auto mb-6">
          <button
            onClick={() => {
              const pathParts = window.location.pathname.split("/");
              const workspaceId = pathParts[2];
              router.push(`/workspace/${workspaceId}/maps`);
            }}
            className="w-10 h-8 flex items-center justify-center text-white bg-blue-400 hover:text-white hover:bg-blue-500 group relative transition-colors"
            aria-label="Back to workspace"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Back to Workspace
            </span>
          </button>
        </div>
      </div>

      {/* Modal Content */}
      {isOpen && selectedItem && (
        <div
          className="fixed left-12 z-50"
          style={{
            top: `${
              MainSidebarModalOptions.findIndex(
                (item) => item.id === selectedItem.id
              ) *
                32 +
              96
            }px`,
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm relative border border-zinc-300 dark:border-zinc-700">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-2 top-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5 text-black dark:text-gray-300" />
            </button>
            {/* Content with text color override */}
            <div className="max-h-[50vh] overflow-y-auto p-4">
              <div className="text-gray-900 dark:text-gray-100">
                {renderModalContent()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MainSidebar;
