"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Menu } from "lucide-react";
import FileUploadModal from "../components/Modals/FileUploadModal";
import {
  getLocalStorageItem,
  safeSetItem,
  handleFileUpload as handleFileUploadUtil,
  handleFileDelete as handleFileDeleteUtil,
  handleFileToggle as handleFileToggleUtil,
} from "../utils/fileHandler";

export type BaseLayerKey = "Light" | "Dark" | "Road";

const Map = dynamic(() => import("../components/Map/Map"), {
  loading: () => <LoadingSpinner />,
  ssr: false,
});

const Sidebar = dynamic(() => import("../components/Sidebar/Sidebar"), {
  ssr: false,
});

const LoadingSpinner = () => {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setRotation((prevRotation) => (prevRotation + 45) % 360);
    }, 100);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex justify-center items-center h-full w-full">
      <div
        className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full"
        style={{ transform: `rotate(${rotation}deg)` }}
      ></div>
    </div>
  );
};

function Home() {
  const BASE_LAYERS: Record<BaseLayerKey, string> = {
    Light: `${typeof window !== "undefined" ? window.location.origin : ""}/OS_VTS_3857_Light.json`,
    Dark: `${typeof window !== "undefined" ? window.location.origin : ""}/OS_VTS_3857_Dark.json`,
    Road: `${typeof window !== "undefined" ? window.location.origin : ""}/OS_VTS_3857_Road.json`,
  };

  const CORE_LAYERS = ["coreLayer1", "coreLayer2"];
  const THEMATIC_LAYERS = ["thematicLayer1", "thematicLayer2"];
  const USER_DEFINED_LAYERS = ["userLayer1", "userLayer2"];

  // State
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeLayers, setActiveLayers] = useState<string[]>(() =>
    getLocalStorageItem("activeLayers", ["baseLayer1"])
  );
  const [uploadedFiles, setUploadedFiles] = useState<string[]>(() =>
    getLocalStorageItem("uploadedFiles", [])
  );
  const [activeFiles, setActiveFiles] = useState<string[]>(() =>
    getLocalStorageItem("activeFiles", [])
  );
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUploadedFileName, setCurrentUploadedFileName] = useState("");
  const [currentUploadedFileContent, setCurrentUploadedFileContent] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedBaseLayer, setSelectedBaseLayer] = useState<BaseLayerKey>("Light");

  const dragCounter = useRef(0);

  // Callbacks
  const handleBaseLayerChange = useCallback((newBaseLayer: BaseLayerKey) => {
    setSelectedBaseLayer(newBaseLayer);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    handleFileUploadUtil(
      file,
      setUploadError,
      setCurrentUploadedFileName,
      setCurrentUploadedFileContent,
      setIsModalOpen,
    );
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload]
  );

  const handleFileDelete = useCallback((fileName: string) => {
    handleFileDeleteUtil(fileName, setUploadedFiles, setActiveFiles);
  }, []);

  const handleFileToggle = useCallback((fileName: string, isActive: boolean) => {
    handleFileToggleUtil(fileName, isActive, setActiveFiles);
  }, []);

  const handleLayerToggle = useCallback((updatedLayers: string[]) => {
    setActiveLayers(updatedLayers);
    safeSetItem("activeLayers", JSON.stringify(updatedLayers));
  }, []);

  const handleLayerNameConfirm = useCallback(
    async (layerName: string, isRemote: boolean) => {
      console.log(`handleLayerNameConfirm called with: ${layerName}, isRemote: ${isRemote}`);
      try {
        const jsonData = JSON.parse(currentUploadedFileContent);
        if (isRemote) {
          console.log("Initiating remote upload...");
          const response = await fetch("/api/remote-file-s3-upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              layerName: layerName,
              data: jsonData,
            }),
          });
          console.log("Response status:", response.status);
          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              "Upload failed:",
              response.status,
              response.statusText,
              errorText,
            );
            throw new Error(
              `Remote upload failed: ${response.status} ${response.statusText}`,
            );
          }
          const result = await response.json();
          console.log("Remote upload successful:");
          safeSetItem(`file:${layerName}`, result.url);
        } else {
          console.log("Performing local upload...");
          safeSetItem(`file:${layerName}`, JSON.stringify(jsonData));
        }
        setUploadedFiles((prev) => {
          const updatedFiles = [...prev, layerName];
          safeSetItem("uploadedFiles", JSON.stringify(updatedFiles));
          return updatedFiles;
        });
      } catch (error) {
        console.error("Error handling file upload:", error);
        setUploadError("Error saving file. Please try again.");
      }
      console.log("Closing modal and resetting state...");
      setIsModalOpen(false);
      setCurrentUploadedFileName("");
      setCurrentUploadedFileContent("");
    },
    [currentUploadedFileContent]
  );

  return (
    <div
      className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLayerToggle={handleLayerToggle}
        onFileUpload={handleFileUpload}
        onFileDelete={handleFileDelete}
        onFileToggle={handleFileToggle}
        activeLayers={activeLayers}
        uploadedFiles={uploadedFiles}
        activeFiles={activeFiles}
        uploadError={uploadError}
        selectedBaseLayer={selectedBaseLayer}
        layerGroups={[
          {
            title: "Base",
            layers: Object.keys(BASE_LAYERS) as BaseLayerKey[],
            onLayerSelect: (layerName: string) => handleBaseLayerChange(layerName as BaseLayerKey)
          },
          { title: "Core", layers: CORE_LAYERS },
          { title: "Thematic", layers: THEMATIC_LAYERS },
          { title: "User Defined", layers: USER_DEFINED_LAYERS },
        ]}
      />
      <main className="flex-1 relative">
        <button
          className="absolute top-4 left-4 z-10 md:hidden text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded-md shadow-md"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-6 h-6" />
        </button>
        <Map
          activeFiles={activeFiles}
          baseLayer={BASE_LAYERS[selectedBaseLayer]}
        />
      </main>
      <FileUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleLayerNameConfirm}
        defaultLayerName={currentUploadedFileName || ""}
      />
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <p className="text-xl font-bold">Drop GeoJSON file here</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
