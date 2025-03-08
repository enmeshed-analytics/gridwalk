"use client";
import React, { useState } from "react";
import { CreateMapModalProps, DeleteMapModalProps } from "../../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const CreateMapModal: React.FC<CreateMapModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [mapId, setMapId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await onSubmit(mapId.trim());
      onClose();
      setMapId("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred creating a new map"
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Map</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md">{error}</div>
        )}
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="mapId">Map Name</Label>
            <Input
              id="mapId"
              value={mapId}
              onChange={(e) => setMapId(e.target.value)}
              placeholder="Enter map name..."
              minLength={3}
              maxLength={50}
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !mapId.trim()}>
            {isLoading ? (
              <>
                <LoadingSpinner />
                <span className="ml-2">Creating...</span>
              </>
            ) : (
              "Create Map"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DeleteMapModal: React.FC<DeleteMapModalProps> = ({
  isOpen,
  onClose,
  mapId,
  mapName,
  onConfirm,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  console.log("DeleteMapModal mapId:", mapId);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the map{" "}
            <span className="font-medium">{mapName}</span> and all associated
            data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md">{error}</div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? (
              <>
                <LoadingSpinner />
                <span className="ml-2">Deleting...</span>
              </>
            ) : (
              "Delete Map"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);
