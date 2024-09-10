import { useCallback } from "react";

// Function to safely get items from localStorage
export const getLocalStorageItem = (key: string, defaultValue: any) => {
  if (typeof window === "undefined") {
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

// Function to safely set items in localStorage
export const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error setting ${key} in localStorage:`, error);
  }
};

// File upload handling function
export const handleFileUpload = (
  file: File,
  setUploadError: (message: string | null) => void,
  setCurrentUploadedFileName: (name: string) => void,
  setCurrentUploadedFileContent: (content: string) => void,
  setIsModalOpen: (isOpen: boolean) => void,
) => {
  setUploadError(null);

  if (
    !file.name.toLowerCase().endsWith(".json") &&
    !file.name.toLowerCase().endsWith(".geojson")
  ) {
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
};

// File delete handling function
export const handleFileDelete = (
  fileName: string,
  setUploadedFiles: (callback: (prev: string[]) => string[]) => void,
  setActiveFiles: (callback: (prev: string[]) => string[]) => void,
) => {
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
};

// Toggle file activation
export const handleFileToggle = (
  fileName: string,
  isActive: boolean,
  setActiveFiles: (callback: (prev: string[]) => string[]) => void,
) => {
  setActiveFiles((prev) => {
    const updatedFiles = isActive
      ? [...prev, fileName]
      : prev.filter((file) => file !== fileName);
    safeSetItem("activeFiles", JSON.stringify(updatedFiles));
    return updatedFiles;
  });
};
