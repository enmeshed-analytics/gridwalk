import React from "react";
import { LayerConfig, LayerStyle } from "../types";

interface Annotation extends GeoJSON.Feature {
  id: string;
  properties: {
    type?: string;
    style?: LayerStyle;
  };
}

interface StyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  layerConfig: LayerConfig | null;
  annotation?: Annotation | null;
  onStyleUpdate: (style: LayerStyle) => void;
}

export function StyleModal({
  isOpen,
  onClose,
  layerConfig,
  annotation,
  onStyleUpdate,
}: StyleModalProps) {
  if (!isOpen || (!layerConfig && !annotation)) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const newStyle: LayerStyle = {
      color: formData.get("color") as string,
      opacity: Number(formData.get("opacity")),
    };

    const geomType = layerConfig?.geomType || annotation?.geometry.type || "";

    if (geomType.toLowerCase().includes("point")) {
      newStyle.radius = Number(formData.get("radius"));
    }
    if (geomType.toLowerCase().includes("line")) {
      newStyle.width = Number(formData.get("width"));
    }

    onStyleUpdate(newStyle);
    onClose();
  };

  const currentStyle = layerConfig?.style ||
    annotation?.properties.style || {
      color: "#0080ff",
      opacity: 0.5,
      radius: 6,
      width: 2,
    };

  const displayName = layerConfig
    ? layerConfig.layerId.split("-").pop() || layerConfig.layerId
    : annotation?.properties.type || "Annotation";

  const geomType = layerConfig?.geomType || annotation?.geometry.type || "";

  return (
    <div className="fixed right-0 top-0 bottom-0 max-w-64 flex items-center justify-end z-40">
      <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 p-4 w-64 h-fit mr-0 rounded-l-xl shadow-2xl border-l border-y border-zinc-300 dark:border-zinc-700">
        <h2 className="text-base font-bold mb-2 truncate text-blue-500 dark:text-blue-400">
          {displayName}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-medium mb-1">Color</label>
              <input
                type="color"
                name="color"
                defaultValue={currentStyle.color}
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
                defaultValue={currentStyle.opacity}
                className="w-full accent-blue-500"
              />
            </div>
            {geomType.toLowerCase().includes("point") && (
              <div>
                <label className="block text-xs font-medium mb-1">Radius</label>
                <input
                  type="number"
                  name="radius"
                  min="1"
                  max="20"
                  defaultValue={currentStyle.radius}
                  className="w-full px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
            )}
            {geomType.toLowerCase().includes("line") && (
              <div>
                <label className="block text-xs font-medium mb-1">Width</label>
                <input
                  type="number"
                  name="width"
                  min="1"
                  max="10"
                  defaultValue={currentStyle.width}
                  className="w-full px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
            )}
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 text-xs font-medium bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
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
