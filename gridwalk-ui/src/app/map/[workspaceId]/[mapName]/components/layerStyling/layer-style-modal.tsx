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
    <div className="fixed inset-y-0 right-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
      <div className="bg-grey-900 p-4 w-72 h-fit mr-2 rounded-lg shadow-lg">
        <h2 className="text-lg mb-3">Style Layer: {layerConfig.layerId}</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Color</label>
              <input
                type="color"
                name="color"
                defaultValue={layerConfig.style.color}
                className="w-full h-8"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Opacity</label>
              <input
                type="range"
                name="opacity"
                min="0"
                max="1"
                step="0.1"
                defaultValue={layerConfig.style.opacity}
                className="w-full"
              />
            </div>
            {layerConfig.geomType.includes("point") && (
              <div>
                <label className="block text-sm mb-1">Radius</label>
                <input
                  type="number"
                  name="radius"
                  min="1"
                  max="20"
                  defaultValue={layerConfig.style.radius}
                  className="w-full px-2 py-1 border rounded"
                />
              </div>
            )}
            {layerConfig.geomType.includes("line") && (
              <div>
                <label className="block text-sm mb-1">Width</label>
                <input
                  type="number"
                  name="width"
                  min="1"
                  max="10"
                  defaultValue={layerConfig.style.width}
                  className="w-full px-2 py-1 border rounded"
                />
              </div>
            )}
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm bg-gray-800 rounded hover:bg-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
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
