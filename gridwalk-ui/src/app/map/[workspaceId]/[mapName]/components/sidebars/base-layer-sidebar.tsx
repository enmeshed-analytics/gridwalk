import React from "react";
import { Sun, Moon, Car } from "lucide-react";
import { BaseLayerSidebarModalOptions, BaseLayerSidebarProps } from "./types";

const BaseLayerSidebar = ({
  onBaseItemClick,
  selectedBaseItem,
  isHydrated = true,
}: BaseLayerSidebarProps) => {
  const baseItems: BaseLayerSidebarModalOptions[] = [
    {
      id: "light",
      title: "Light Mode",
      icon: "light",
      description: "Light blue base map style",
    },
    {
      id: "dark",
      title: "Dark Mode",
      icon: "dark",
      description: "Dark blue base map style",
    },
    {
      id: "car",
      title: "Car Mode",
      icon: "car",
      description: "Purple navigation style",
    },
  ];

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "light":
        return <Sun className="w-4 h-4" />;
      case "dark":
        return <Moon className="w-4 h-4" />;
      case "car":
        return <Car className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Helper function to get the selected style based on the base layer type
  const getSelectedStyle = (id: string) => {
    switch (id) {
      case "light":
        return "bg-yellow-500 text-white";
      case "dark":
        return "bg-blue-800 text-white";
      case "car":
        return "bg-purple-500 text-white";
      default:
        return "bg-blue-500 text-white";
    }
  };

  // Helper function to get the button style based on the base layer type
  // this uses default and then the selected style from local storage
  const getButtonStyle = (item: BaseLayerSidebarModalOptions) => {
    if (!isHydrated) {
      return item.id === "light"
        ? "bg-yellow-500 text-white"
        : "text-white hover:bg-gray-300";
    }

    return selectedBaseItem?.id === item.id
      ? getSelectedStyle(item.id)
      : "text-white hover:bg-gray-300";
  };

  return (
    <div className="fixed bottom-0 right-0 z-10">
      <div className="bg-gray-800 rounded-t-lg shadow-lg px-2 py-1 flex items-center space-x-1">
        {baseItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onBaseItemClick(item)}
            className={`p-2 rounded-md transition-colors ${getButtonStyle(
              item
            )}`}
            title={item.title}
          >
            {getIconComponent(item.icon || "")}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BaseLayerSidebar;
