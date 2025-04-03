import { useCallback } from "react";
import { useSingleFileUploader, useShapefileUploader } from "./fileUpload";
import {
  getWorkspaceConnections,
  WorkspaceConnection,
} from "../actions/getSources";

interface UseFileUploaderProps {
  fileName: string;
  workspaceId: string;
  setUploadError: (error: string | null) => void;
  setUploadSuccess: (success: boolean) => void;
  setUploadProgress: (progress: number) => void;
  setIsUploading: (isUploading: boolean) => void;
  setWorkspaceConnections: (connections: WorkspaceConnection[]) => void;
  handleModalClose: () => void;
}

export const useFileUploader = ({
  fileName,
  workspaceId,
  setUploadError,
  setUploadSuccess,
  setUploadProgress,
  setIsUploading,
  setWorkspaceConnections,
  handleModalClose,
}: UseFileUploaderProps) => {
  const { uploadSingleFile } = useSingleFileUploader();
  const { uploadShapefile } = useShapefileUploader();

  const handleFileUpload = useCallback(
    async (fileToUpload: File) => {
      if (!fileToUpload || !fileName.trim()) {
        setUploadError("Please provide a valid file and name");
        return;
      }

      const extension = fileToUpload.name.split(".").pop()?.toLowerCase();
      if (!extension) {
        setUploadError("File must have an extension");
        return;
      }

      // Supported file types
      const supportedTypes = [
        "gpkg",
        "zip",
        "xlsx",
        "csv",
        "parquet",
        "json",
        "geojson",
      ];

      if (!supportedTypes.includes(extension)) {
        setUploadError(
          `Unsupported file type: ${extension}. Supported types are: ${supportedTypes.join(
            ", "
          )}`
        );
        return;
      }

      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(false);
      setUploadProgress(0);

      try {
        const renamedFile = new File(
          [fileToUpload],
          `${fileName}${extension ? `.${extension}` : ""}`,
          { type: fileToUpload.type }
        );

        if (extension === "zip") {
          await uploadShapefile(
            renamedFile,
            "",
            setUploadProgress,
            () => {
              setUploadSuccess(true);
              setTimeout(() => {
                setUploadSuccess(false);
                handleModalClose();
              }, 1500);
            },
            (error) => {
              setUploadError(error);
              setTimeout(() => {
                handleModalClose();
              }, 1500);
            }
          );
        } else {
          await uploadSingleFile(
            renamedFile,
            "",
            setUploadProgress,
            () => {
              setUploadSuccess(true);
              setTimeout(() => {
                setUploadSuccess(false);
                handleModalClose();
              }, 1500);
            },
            (error) => {
              setUploadError(error);
              setTimeout(() => {
                handleModalClose();
              }, 1500);
            }
          );
        }

        // Refresh connections after successful upload
        try {
          const connections = await getWorkspaceConnections(workspaceId);
          setWorkspaceConnections(connections);
        } catch (error) {
          console.error("Failed to refresh workspace connections:", error);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          setUploadError(error.message);
          console.log(`Upload Error: ${error.message}`);
        } else {
          setUploadError("An unknown error occurred");
          console.log("Unknown upload error:", error);
        }
        setTimeout(() => {
          handleModalClose();
        }, 1500);
      } finally {
        setIsUploading(false);
      }
    },
    [
      fileName,
      uploadSingleFile,
      uploadShapefile,
      workspaceId,
      handleModalClose,
      setUploadSuccess,
      setUploadError,
      setUploadProgress,
      setIsUploading,
      setWorkspaceConnections,
    ]
  );

  return {
    handleFileUpload,
  };
};
