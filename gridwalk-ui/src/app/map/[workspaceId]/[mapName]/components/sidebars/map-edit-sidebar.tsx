import React, { useEffect } from "react";
import { Dot, Square, GitBranch, NetworkIcon } from "lucide-react";
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
      description: "Draw points",
    },
    {
      id: "line",
      title: "Draw Line",
      icon: "line",
      description: "Draw lines",
    },
    {
      id: "square",
      title: "Draw Polygon",
      icon: "square",
      description: "Draw polygons",
    },
    {
      id: "bbox",
      title: "Bounding Box",
      icon: "bbox",
      description: "Call National Geographical Database",
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
      case "bbox":
        return <NetworkIcon className="w-4 h-4" />;
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
        selectedEditItem?.id === "line" ||
        selectedEditItem?.id === "bbox"
      ) {
        mapElement.style.cursor = "crosshair";
      } else {
        mapElement.style.cursor = "grab";
      }
    }
  }, [selectedEditItem]);

  return (
    <div className="absolute top-0.4 left-1/2 transform -translate-x-1/2 z-10">
      <div className="bg-gray-800 rounded-lg shadow-lg px-2 py-1 flex items-center space-x-1 relative">
        {editItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onEditItemClick(item)}
            className={`
              p-2 rounded-md transition-colors group
              ${
                selectedEditItem?.id === item.id
                  ? "bg-blue-400 text-white"
                  : "text-gray-300 hover:bg-blue-400"
              }
            `}
          >
            {getIconComponent(item.icon || "")}
            <div className="absolute invisible group-hover:visible bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap z-50">
              {item.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MapEditSidebar;
