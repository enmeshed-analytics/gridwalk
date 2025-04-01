import React, { useEffect } from "react";
import { Dot, Square, Trash, GitBranch } from "lucide-react";
import { MapEditSidebarModalOptions, MapEditsProps } from "./types";

const MapEditSidebar = ({
  onEditItemClick,
  selectedEditItem,
}: MapEditsProps) => {
  const editItems: MapEditSidebarModalOptions[] = [
    {
      id: "point",
      title: "Draw Point",
      icon: "point",
      description: "Draw points on map",
    },
    {
      id: "line",
      title: "Draw Line",
      icon: "line",
      description: "Draw lines on map",
    },
    {
      id: "square",
      title: "Draw Polygon",
      icon: "square",
      description: "Draw polygons on map",
    },
    {
      id: "delete",
      title: "Delete",
      icon: "delete",
      description: "Delete selected features",
    },
  ];

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "point":
        return <Dot className="w-4 h-4" />;
      case "line":
        return <GitBranch className="w-4 h-4" />;
      case "square":
        return <Square className="w-4 h-4" />;
      case "delete":
        return <Trash className="w-4 h-4" />;
      default:
        return null;
    }
  };

  useEffect(() => {
    const map = document.querySelector(".maplibregl-canvas-container");
    if (map) {
      const mapElement = map as HTMLElement;
      if (
        selectedEditItem?.id === "square" ||
        selectedEditItem?.id === "hexagon" ||
        selectedEditItem?.id === "circle" ||
        selectedEditItem?.id === "point" ||
        selectedEditItem?.id === "line"
      ) {
        mapElement.style.cursor = "crosshair";
      } else if (selectedEditItem?.id === "delete") {
        mapElement.style.cursor = "not-allowed";
      } else {
        mapElement.style.cursor = "";
      }
    }
  }, [selectedEditItem]);

  return (
    <div className="absolute top-0.4 left-1/2 transform -translate-x-1/2 z-10">
      <div className="bg-gray-800 rounded-lg shadow-lg px-2 py-1 flex items-center space-x-1">
        {editItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onEditItemClick(item)}
            className={`
              p-2 rounded-md transition-colors
              ${
                selectedEditItem?.id === item.id
                  ? "bg-blue-400 text-white"
                  : "text-gray-300 hover:bg-blue-400"
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

export default MapEditSidebar;
