import React from "react";

interface OSAPIProperties {
  designatedname1_text?: string;
  usrn?: number;
  townname1_text?: string;
  administrativearea1_text?: string;
  operationalstate?: string;
  [key: string]: unknown;
}

interface SelectedFeature {
  id: string | number | undefined;
  layerId: string;
  properties: Record<string, unknown>;
}

interface FeatureModalProps {
  isOpen: boolean;
  selectedFeature: SelectedFeature | null;
  onClose: () => void;
  onClearSelection: () => void;
  onClearOSApiLayer?: () => void;
}

export function FeatureModal({
  isOpen,
  selectedFeature,
  onClose,
  onClearSelection,
  onClearOSApiLayer,
}: FeatureModalProps) {
  if (!isOpen || !selectedFeature) {
    return null;
  }

  const handleClose = () => {
    onClose();
    onClearSelection();
  };

  const handleClearOSData = () => {
    if (onClearOSApiLayer) {
      onClearOSApiLayer();
    }
    handleClose();
  };

  return (
    <div className="absolute top-32 right-0 bg-gray-100 dark:bg-gray-800 p-4 rounded-xl z-50 w-80">
      <div className="flex justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {selectedFeature.layerId.startsWith("os-api-")
            ? "Street"
            : "Feature Details"}
        </h2>
        <button
          onClick={handleClose}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl"
        >
          ×
        </button>
      </div>

      {/* Show street name for OS API features */}
      {selectedFeature.layerId.startsWith("os-api-") && (
        <div className="mb-3">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {(selectedFeature.properties as OSAPIProperties)
              .designatedname1_text || "Unnamed Street"}
          </h3>
        </div>
      )}

      <div className="space-y-2 text-sm">
        <p className="text-gray-900 dark:text-gray-100">
          <strong>Layer:</strong>{" "}
          <span className="text-gray-600 dark:text-gray-300">
            {selectedFeature.layerId}
          </span>
        </p>
        <p className="text-gray-900 dark:text-gray-100">
          <strong>Feature ID:</strong>{" "}
          <span className="text-gray-600 dark:text-gray-300">
            {selectedFeature.id || "N/A"}
          </span>
        </p>

        {Object.keys(selectedFeature.properties).length > 0 && (
          <div>
            <strong className="text-gray-900 dark:text-gray-100">
              Properties:
            </strong>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {Object.entries(selectedFeature.properties).map(
                ([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {key}:
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 truncate ml-2">
                      {String(value)}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="flex justify-between gap-2">
          {selectedFeature.layerId.startsWith("os-api-") && (
            <button
              onClick={handleClearOSData}
              className="px-4 py-2 text-sm bg-red-500 dark:bg-red-600 text-white rounded-xl hover:bg-red-600 dark:hover:bg-red-500 transition-colors flex items-center gap-2 font-medium shadow-md"
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
              Clear OS Data
            </button>
          )}

          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
