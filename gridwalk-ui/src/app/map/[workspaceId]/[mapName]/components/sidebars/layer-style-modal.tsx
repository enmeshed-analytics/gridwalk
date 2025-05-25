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
  onAnnotationDelete?: () => void;
}

export function StyleModal({
  isOpen,
  onClose,
  layerConfig,
  annotation,
  onStyleUpdate,
  onAnnotationDelete,
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

  const handleDelete = () => {
    if (onAnnotationDelete) {
      onAnnotationDelete();
      onClose();
    }
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

            {/* Delete button for annotations - TODO: change styles */}
            {annotation && onAnnotationDelete && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full px-3 py-2 text-sm bg-red-500 dark:bg-red-600 text-white rounded-md hover:bg-red-600 dark:hover:bg-red-500 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Annotation
                </button>
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
