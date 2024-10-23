// app/components/mapModal/mapModal.tsx
import React from "react";
import { Map, Layers, Settings, Info, X } from "lucide-react";
import { ModalProps, NavItem } from "./types";

const MapModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onNavItemClick,
  selectedItem,
  children,
}) => {
  const navItems: NavItem[] = [
    {
      id: "map",
      title: "Map Settings",
      icon: "map",
      description: "Configure map display options",
    },
    {
      id: "layers",
      title: "Layers",
      icon: "layers",
      description: "Manage map layers",
    },
    {
      id: "settings",
      title: "Settings",
      icon: "settings",
      description: "Application settings",
    },
    {
      id: "about",
      title: "About",
      icon: "info",
      description: "About this application",
    },
  ];

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "map":
        return <Map className="w-5 h-5" />;
      case "layers":
        return <Layers className="w-5 h-5" />;
      case "settings":
        return <Settings className="w-5 h-5" />;
      case "info":
        return <Info className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Navigation Bar - Now on the left */}
      <div className="fixed left-0 top-0 h-full w-12 bg-gray-800 shadow-lg z-10 flex flex-col items-center py-6 rounded-r-lg">
        {/* GW Text at top */}
        <div className="py-4 text-gray-300 font-bold">GW</div>

        {/* Separator line */}
        <div className="w-8 h-px bg-gray-600 mb-4"></div>

        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavItemClick(item)}
            className={`
              w-12 h-12 mb-4 flex items-center justify-center rounded-lg
              transition-colors group relative
              ${
                selectedItem?.id === item.id
                  ? "bg-gray-100 text-blue-600"
                  : "text-gray-300 hover:bg-blue-400 hover:text-white"
              }
            `}
            aria-label={item.title}
          >
            {getIconComponent(item.icon || "")}
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {item.title}
            </span>
          </button>
        ))}
      </div>

      {/* Modal Content */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 m-4 max-w-xl w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">
                {selectedItem?.title || "Map Settings"}
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">{children}</div>
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MapModal;
