"use client";
import { Layers, Sun, Moon, Globe, MapPin, User, Car } from "lucide-react";
import React from "react";

// Define a mapping for layer types or specific layer names
export const layerIcons: Record<string, React.ElementType> = {
  Base: Layers,
  Light: Sun,
  Dark: Moon,
  Core: Globe,
  Thematic: MapPin,
  UserDefined: User,
  Road: Car,
  // Add more mappings as needed
};

// Define base layer colours for buttons
export const layerButtonColors: Record<string, string> = {
  Light: "bg-yellow-400 hover:bg-yellow-500 focus:ring-yellow-300",
  Dark: "bg-purple-700 hover:bg-purple-800 focus:ring-purple-600",
  Road: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
};

/* eslint-disable no-unused-vars */
export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onLayerToggle: (updatedLayers: string[]) => void;
  onFileUpload: (file: File) => void;
  uploadError: string | null;
  onFileDelete: (fileName: string) => void;
  onFileToggle: (fileName: string, isActive: boolean) => void;
  activeLayers: string[];
  uploadedFiles: string[];
  activeFiles: string[];
  baseLayers: string[];
  coreLayers: string[];
  thematicLayers: string[];
  userDefinedLayers: string[];
  onBaseLayerChange: (newBaseLayer: "Light" | "Dark" | "Road") => void;
}
