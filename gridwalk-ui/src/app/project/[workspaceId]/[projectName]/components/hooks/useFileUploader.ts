// import { useCallback } from "react";
// import { useSingleFileUploader, useShapefileUploader } from "./fileUpload";
// import {
//   getWorkspaceConnections,
//   WorkspaceConnection,
// } from "../actions/getSources";

// interface UseFileUploaderProps {
//   fileName: string;
//   workspaceId: string;
//   setUploadError: (error: string | null) => void;
//   setUploadSuccess: (success: boolean) => void;
//   setUploadProgress: (progress: number) => void;
//   setIsUploading: (isUploading: boolean) => void;
//   setWorkspaceConnections: (connections: any) => void;
//   handleModalClose: () => void;
// }

// export const useFileUploader = ({
//     fileName,
//     workspaceId,
//     setUploadError,
//     setUploadSuccess,
//     setUploadProgress,
//     setIsUploading,
//     setWorkspaceConnections,
//     handleModalClose,
//   }: UseFileUploaderProps) => {
//     const { uploadSingleFile } = useSingleFileUploader();
//     const { uploadShapefile } = useShapefileUploader();
