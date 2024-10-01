import React, { useState, useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line no-unused-vars
  onConfirm: (layerName: string, isRemote: boolean) => void;
  defaultLayerName: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  defaultLayerName,
}) => {
  const [layerName, setLayerName] = useState(defaultLayerName);

  useEffect(() => {
    setLayerName(defaultLayerName);
  }, [defaultLayerName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
          Enter Layer Name
        </h3>
        <input
          type="text"
          value={layerName}
          onChange={(e) => setLayerName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Layer name"
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 mr-4"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(layerName, false)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 mr-4"
          >
            Local Upload
          </button>
          <button
            onClick={() => onConfirm(layerName, true)}
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
          >
            S3 Upload
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
