import React from "react";
import { Map, Layers, Settings, Info, File, X } from "lucide-react";
import { ModalProps, MainMapNav } from "./types";

{
  /* Create NavBar map Modal */
}
const MapModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onNavItemClick,
  selectedItem,
  children,
}) => {
  const MainMapNavs: MainMapNav[] = [
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
      id: "upload",
      title: "File Upload",
      icon: "file",
      description: "Upload files and add a layer to the map",
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
      case "file":
        return <File className="w-5 h-5" />;
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
      {/* Navigation Bar */}
      <div className="fixed left-0 top-0 h-full w-10 bg-gray-800 shadow-lg z-10 flex flex-col items-center py-6 rounded-r-lg">
        {/* GW Text at top */}
        <div className="py-4 text-gray-300 font-bold">GW</div>
        {/* Separator line */}
        <div className="w-8 h-px bg-gray-600 mb-4"></div>
        {/* Navigation Items */}
        {MainMapNavs.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavItemClick(item)}
            className={`
              w-10 h-8 mb-4 flex items-center justify-center rounded-lg
              transition-colors group relative
              ${
                selectedItem?.id === item.id
                  ? "bg-blue-400 text-white"
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
      {isOpen && selectedItem && (
        <div
          className="fixed left-12 z-50"
          style={{
            top: `${MainMapNavs.findIndex((item) => item.id === selectedItem.id) * 32 + 96}px`,
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-sm relative">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-2 top-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
            {/* Content with black text override */}
            <div className="max-h-[50vh] overflow-y-auto p-4">
              <div className="text-gray-900">
                {" "}
                {/* Force black text for content */}
                {children}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MapModal;