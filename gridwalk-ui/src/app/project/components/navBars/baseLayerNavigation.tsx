import React from "react";
import { Sun, Moon, Car } from "lucide-react";
import { BaseEditNav } from "./types";

interface BaseLayerNavProps {
  onBaseItemClick: (item: BaseEditNav) => void;
  selectedBaseItem: BaseEditNav | null;
}

const BaseLayerNav: React.FC<BaseLayerNavProps> = ({
  onBaseItemClick,
  selectedBaseItem,
}) => {
  const baseItems: BaseEditNav[] = [
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

  return (
    <div className="fixed bottom-0 right-0 z-10">
      <div className="bg-gray-800 rounded-t-lg shadow-lg px-2 py-1 flex items-center space-x-1">
        {baseItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onBaseItemClick(item)}
            className={`
              p-2 rounded-md transition-colors
              ${
                selectedBaseItem?.id === item.id
                  ? getSelectedStyle(item.id)
                  : "text-white hover:bg-gray-700"
              }
            `}
            title={item.title}
          >
            {getIconComponent(item.icon || "")}
          </button>
        ))}
      </div>
    </div>
  );
};

// Helper function to get the selected style based on the base layer type
const getSelectedStyle = (id: string) => {
  switch (id) {
    case "light":
      return "bg-blue-300 text-white"; // Light blue
    case "dark":
      return "bg-blue-800 text-white"; // Dark blue
    case "car":
      return "bg-purple-500 text-white"; // Purple
    default:
      return "bg-blue-500 text-white";
  }
};

export default BaseLayerNav;
