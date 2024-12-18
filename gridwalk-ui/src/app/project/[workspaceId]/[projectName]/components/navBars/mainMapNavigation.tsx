"use client";
import React, { useState } from "react";
import { Layers, File, X, Upload, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalProps, MainMapNav, WorkspaceConnection } from "./types";
import { useRouter } from "next/navigation";

interface LayersTableProps {
  connections: WorkspaceConnection[];
  onLayerClick?: (connection: WorkspaceConnection) => void;
}

// Loading dots for file upload
const LoadingDots = () => (
  <div className="flex gap-1">
    <div className="h-2 w-2 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_infinite]"></div>
    <div className="h-2 w-2 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_0.2s_infinite]"></div>
    <div className="h-2 w-2 rounded-full bg-blue-500 animate-[bounce_1s_ease-in-out_0.4s_infinite]"></div>
  </div>
);

// Table to the available layers
const LayersTable: React.FC<LayersTableProps> = ({
  connections,
  onLayerClick,
}) => {
  const [selectedButtons, setSelectedButtons] = useState<{
    [key: number]: boolean;
  }>({});

  const toggleButton = (index: number, connection: WorkspaceConnection) => {
    setSelectedButtons((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
    onLayerClick?.(connection);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <tbody>
          {connections.map((connection, index) => (
            <tr
              key={index}
              className={`border-t border-gray-200 ${
                index % 2 === 0 ? "bg-white" : "bg-gray-50"
              }`}
            >
              <td className="px-4 py-3 text-sm text-gray-900">
                <div className="flex items-center justify-between">
                  <span>{String(connection)}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => toggleButton(index, connection)}
                    className={`ml-4 ${
                      selectedButtons[index] ? "text-green-600" : ""
                    }`}
                  >
                    Select
                  </Button>
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
const MapModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onNavItemClick,
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
}) => {
  const router = useRouter();
  const [uploadKey, setUploadKey] = React.useState(0);

  React.useEffect(() => {
    if (uploadSuccess) {
      setUploadKey((prev) => prev + 1);
    }
  }, [uploadSuccess]);

  const MainMapNavs: MainMapNav[] = [
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
      description:
        "Upload files and add a layer to the map. Currently accepts .geojson, .json, .gpkg files, .xlsx, and .parquet",
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
          <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Available Layers</h2>
            {workspaceConnections?.length > 0 ? (
              <div className="mb-6">
                <LayersTable connections={workspaceConnections} />{" "}
              </div>
            ) : (
              <p className="text-gray-600">No layers available.</p>
            )}
          </div>
        );

      case "upload":
        return (
          <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Upload</h2>

            {/* Upload Section */}
            {!selectedFile ? (
              <div className="mb-6">
                <label
                  key={uploadKey}
                  className="flex flex-col items-center px-4 py-6 bg-white rounded-lg shadow-lg border-2 border-dashed border-gray-300 hover:border-blue-400 cursor-pointer transition-colors"
                >
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
            ) : (
              <div className="mb-6 space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    Selected file: {selectedFile.name}
                  </p>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Enter layer name:
                    </label>
                    <input
                      type="text"
                      value={fileName}
                      onChange={(e) => onFileNameChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter layer name"
                    />
                  </div>
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={handleUploadClick}
                      disabled={!fileName.trim() || isUploading}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Upload
                    </button>
                    <button
                      onClick={onCancelSelection}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isUploading && (
              <div className="flex items-center justify-center space-x-2 text-blue-500 mb-4">
                <LoadingDots />
                <span className="ml-2">Uploading file ({uploadProgress}%)</span>
              </div>
            )}

            {uploadSuccess && !isUploading && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md flex items-center">
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                <span>File uploaded successfully!</span>
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
            className="w-10 h-8 flex items-center justify-center text-white bg-blue-400 hover:text-white hover:bg-blue-500 group relative"
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
            top: `${
              MainMapNavs.findIndex((item) => item.id === selectedItem.id) *
                32 +
              96
            }px`,
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
