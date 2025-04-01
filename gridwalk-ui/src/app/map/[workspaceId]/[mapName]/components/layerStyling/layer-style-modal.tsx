import React from "react";
import { LayerConfig, LayerStyle } from "../types";

interface StyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  layerConfig: LayerConfig | null;
  onStyleUpdate: (style: LayerStyle) => void;
}

export function StyleModal({
  isOpen,
  onClose,
  layerConfig,
  onStyleUpdate,
}: StyleModalProps) {
  if (!isOpen || !layerConfig) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const newStyle: LayerStyle = {
      color: formData.get("color") as string,
      opacity: Number(formData.get("opacity")),
    };

    if (layerConfig.geomType.includes("point")) {
      newStyle.radius = Number(formData.get("radius"));
    }
    if (layerConfig.geomType.includes("line")) {
      newStyle.width = Number(formData.get("width"));
    }

    onStyleUpdate(newStyle);
    onClose();
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 max-w-64 flex items-center justify-end z-40">
      <div className="bg-white text-gray-800 p-4 w-64 h-fit mr-0 rounded-l-xl shadow-2xl border-l border-y border-zinc-300">
        <h2 className="text-base font-medium mb-2 truncate">
          {layerConfig.layerId.split("-").pop() || layerConfig.layerId}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-medium mb-1">Color</label>
              <input
                type="color"
                name="color"
                defaultValue={layerConfig.style.color}
                className="w-full h-7 rounded-md cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Opacity</label>
              <input
                type="range"
                name="opacity"
                min="0"
                max="1"
                step="0.1"
                defaultValue={layerConfig.style.opacity}
                className="w-full accent-blue-500"
              />
            </div>
            {layerConfig.geomType.includes("point") && (
              <div>
                <label className="block text-xs font-medium mb-1">Radius</label>
                <input
                  type="number"
                  name="radius"
                  min="1"
                  max="20"
                  defaultValue={layerConfig.style.radius}
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
            )}
            {layerConfig.geomType.includes("line") && (
              <div>
                <label className="block text-xs font-medium mb-1">Width</label>
                <input
                  type="number"
                  name="width"
                  min="1"
                  max="10"
                  defaultValue={layerConfig.style.width}
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
            )}
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 text-xs font-medium bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
