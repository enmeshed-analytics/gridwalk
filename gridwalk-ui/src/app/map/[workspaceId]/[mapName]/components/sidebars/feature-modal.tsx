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
    <div className="absolute top-20 right-4 bg-gray-100 dark:bg-gray-800 p-3 rounded-xl z-50 w-64 shadow-lg">
      <div className="flex justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Feature Details
        </h2>
        <button
          onClick={handleClose}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-lg"
        >
          ×
        </button>
      </div>

      {/* Shorter fixed height scrollable container */}
      <div className="h-40 overflow-y-auto pr-1">
        {/* Show street name for OS API features */}
        {selectedFeature.layerId.startsWith("os-api-") && (
          <div className="mb-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {(selectedFeature.properties as OSAPIProperties)
                .designatedname1_text || "Unnamed Street"}
            </h3>
          </div>
        )}

        <div className="space-y-1 text-xs">
          <p className="text-gray-900 dark:text-gray-100">
            <strong>Layer:</strong>{" "}
            <span className="text-gray-600 dark:text-gray-300">
              {selectedFeature.layerId}
            </span>
          </p>
          <p className="text-gray-900 dark:text-gray-100">
            <strong>Feature ID:</strong>{" "}
            <span className="text-gray-600 dark:text-gray-300 truncate">
              {selectedFeature.id || "N/A"}
            </span>
          </p>

          {Object.keys(selectedFeature.properties).length > 0 && (
            <div>
              <strong className="text-gray-900 dark:text-gray-100">
                Properties:
              </strong>
              <div className="mt-1 space-y-1">
                {Object.entries(selectedFeature.properties).map(
                  ([key, value]) => {
                    // Check if value is an object or array
                    const isNested =
                      typeof value === "object" && value !== null;

                    return (
                      <div key={key} className="text-xs mb-1">
                        <div className="font-medium text-gray-700 dark:text-gray-300">
                          {key}: {!isNested && String(value)}
                        </div>

                        {/* Show nested objects in a compact way */}
                        {isNested && Array.isArray(value) && (
                          <div className="ml-2 text-[10px] text-gray-600 dark:text-gray-400">
                            Array ({value.length} items)
                            {value.map((item, i) => (
                              <div
                                key={i}
                                className="ml-2 mt-1 p-1 border-l border-gray-300 dark:border-gray-600"
                              >
                                {typeof item === "object"
                                  ? Object.entries(item).map(([k, v]) => (
                                      <div key={k}>
                                        <span className="font-medium">
                                          {k}:
                                        </span>{" "}
                                        {String(v)}
                                      </div>
                                    ))
                                  : String(item)}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show nested objects that aren't arrays */}
                        {isNested && !Array.isArray(value) && (
                          <div className="ml-2 text-[10px] text-gray-600 dark:text-gray-400">
                            {Object.entries(value as object).map(([k, v]) => (
                              <div key={k}>
                                <span className="font-medium">{k}:</span>{" "}
                                {String(v)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between gap-1">
          {selectedFeature.layerId.startsWith("os-api-") && (
            <button
              onClick={handleClearOSData}
              className="px-2 py-1 text-xs bg-red-500 dark:bg-red-600 text-white rounded hover:bg-red-600 dark:hover:bg-red-500 transition-colors"
            >
              Clear OS Data
            </button>
          )}

          <button
            onClick={handleClose}
            className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
