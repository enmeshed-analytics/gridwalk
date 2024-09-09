"use client";
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from 'next/dynamic';
import { Menu } from "lucide-react";
import Sidebar from "../components/Sidebar/Sidebar";
import FileUploadModal from "../components/Modals/FileUploadModal";

const Map = dynamic(() => import('../components/Map/Map'), {
  loading: () => <p>Loading map...</p>,
  ssr: false
});

const LAYER_NAMES = ["roads", "buildings"];

// Function to safely get items from localStorage
const getLocalStorageItem = (key: string, defaultValue: any) => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return defaultValue;
  }
};

const Home: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeLayers, setActiveLayers] = useState<string[]>(() => getLocalStorageItem("activeLayers", ["roads"]));
  const [uploadedFiles, setUploadedFiles] = useState<string[]>(() => getLocalStorageItem("uploadedFiles", []));
  const [activeFiles, setActiveFiles] = useState<string[]>(() => getLocalStorageItem("activeFiles", []));
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUploadedFileName, setCurrentUploadedFileName] = useState("");
  const [currentUploadedFileContent, setCurrentUploadedFileContent] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const safeSetItem = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(`Error setting ${key} in localStorage:`, error);
    }
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

  const handleFileDrop = useCallback((file: File) => {
    setUploadError(null);

    if (!file.name.toLowerCase().endsWith(".json") && !file.name.toLowerCase().endsWith(".geojson")) {
      setUploadError("Please upload a GeoJSON file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        JSON.parse(content); // Validate JSON
        setCurrentUploadedFileName(file.name);
        setCurrentUploadedFileContent(content);
        setIsModalOpen(true);
      } catch (error) {
        setUploadError("Invalid GeoJSON file.");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileDrop(files[0]);
      }
    },
    [handleFileDrop]
  );

  const handleFileUpload = useCallback((file: File) => {
    setUploadError(null);

    if (!file.name.toLowerCase().endsWith(".json") && !file.name.toLowerCase().endsWith(".geojson")) {
      setUploadError("Please upload a GeoJSON file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        JSON.parse(content); // Validate JSON
        setCurrentUploadedFileName(file.name);
        setCurrentUploadedFileContent(content);
        setIsModalOpen(true);
      } catch (error) {
        setUploadError("Invalid GeoJSON file.");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleLayerNameConfirm = useCallback(async (layerName: string, isRemote: boolean) => {
    console.log(`handleLayerNameConfirm called with: ${layerName}, isRemote: ${isRemote}`);
    try {
      const jsonData = JSON.parse(currentUploadedFileContent);
      if (isRemote) {
        // Remote upload logic
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
          console.error("Upload failed:", response.status, response.statusText, errorText);
          throw new Error(`Remote upload failed: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        console.log("Remote upload successful:");
        safeSetItem(`file:${layerName}`, result.url);
      } else {
        // Local upload logic
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
  }, [currentUploadedFileContent, safeSetItem]);

  const handleFileDelete = useCallback((fileName: string) => {
    try {
      localStorage.removeItem(`file:${fileName}`);
    } catch (error) {
      console.error(`Error removing ${fileName} from localStorage:`, error);
    }
    setUploadedFiles((prev) => {
      const updatedFiles = prev.filter((file) => file !== fileName);
      safeSetItem("uploadedFiles", JSON.stringify(updatedFiles));
      return updatedFiles;
    });
    setActiveFiles((prev) => prev.filter((file) => file !== fileName));
  }, [safeSetItem]);

  const handleFileToggle = useCallback((fileName: string, isActive: boolean) => {
    setActiveFiles((prev) => {
      const updatedFiles = isActive
        ? [...prev, fileName]
        : prev.filter((file) => file !== fileName);
      safeSetItem("activeFiles", JSON.stringify(updatedFiles));
      return updatedFiles;
    });
  }, [safeSetItem]);

  const handleLayerToggle = useCallback((updatedLayers: string[]) => {
    setActiveLayers(updatedLayers);
    safeSetItem("activeLayers", JSON.stringify(updatedLayers));
  }, [safeSetItem]);

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
        onClose={useCallback(() => setSidebarOpen(false), [])}
        onLayerToggle={handleLayerToggle}
        onFileUpload={handleFileUpload}
        onFileDelete={handleFileDelete}
        onFileToggle={handleFileToggle}
        activeLayers={activeLayers}
        layerNames={LAYER_NAMES}
        uploadedFiles={uploadedFiles}
        activeFiles={activeFiles}
        uploadError={uploadError}
      />
      <main className="flex-1 relative">
        <button
          className="absolute top-4 left-4 z-10 md:hidden text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded-md shadow-md"
          onClick={useCallback(() => setSidebarOpen(true), [])}
        >
          <Menu className="w-6 h-6" />
        </button>
        <Map activeFiles={activeFiles} />
      </main>
      <FileUploadModal
        isOpen={isModalOpen}
        onClose={useCallback(() => setIsModalOpen(false), [])}
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
};

export default Home;
