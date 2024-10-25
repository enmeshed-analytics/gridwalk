"use client";
import React, { useState } from "react";
import { useMapInit } from "./components/mapInit/mapInit";
import MainMapNavigation from "./components/navBars/mainMapNavigation";
import { MainMapNav } from "./components/navBars/types";
import MapEditNavigation from "./components/navBars/mapEditNavigation";
import { MapEditNav } from "./components/navBars/types";
import BaseLayerNavigation from "./components/navBars/baseLayerNavigation";
import { BaseEditNav } from "./components/navBars/types";

// Map styles configuration
const MAP_STYLES = {
  light: "/OS_VTS_3857_Light.json",
  dark: "/OS_VTS_3857_Dark.json",
  car: "/OS_VTS_3857_Road.json",
} as const;

// Initial map configuration
const INITIAL_MAP_CONFIG = {
  center: [-0.1278, 51.5074] as [number, number],
  zoom: 11,
};

export default function Project() {
  // State management
  const [selectedItem, setSelectedItem] = useState<MainMapNav | null>(null);
  const [selectedEditItem, setSelectedEditItem] = useState<MapEditNav | null>(
    null,
  );
  const [selectedBaseItem, setSelectedBaseItem] = useState<BaseEditNav | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<string>(MAP_STYLES.light);

  // Map initialization
  const { mapContainer, mapError } = useMapInit({
    ...INITIAL_MAP_CONFIG,
    styleUrl: currentStyle,
  });

  // Event handlers
  const handleNavItemClick = (item: MainMapNav) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleEditItemClick = (item: MapEditNav) => {
    setSelectedEditItem(item === selectedEditItem ? null : item);
  };

  const handleBaseItemClick = (item: BaseEditNav) => {
    setSelectedBaseItem(item);
    switch (item.id) {
      case "light":
        setCurrentStyle(MAP_STYLES.light);
        break;
      case "dark":
        setCurrentStyle(MAP_STYLES.dark);
        break;
      case "car":
        setCurrentStyle(MAP_STYLES.car);
        break;
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="w-full h-screen relative">
      {/* Error display */}
      {mapError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg">
          {mapError}
        </div>
      )}

      {/* Map container */}
      <div className="absolute inset-0 pl-10">
        <div ref={mapContainer} className="h-full w-full" />
      </div>

      {/* Navigation components */}
      <MapEditNavigation
        onEditItemClick={handleEditItemClick}
        selectedEditItem={selectedEditItem}
      />

      <MainMapNavigation
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onNavItemClick={handleNavItemClick}
        selectedItem={selectedItem}
      >
        {selectedItem && (
          <div>
            <h2 className="text-xl font-bold mb-4">{selectedItem.title}</h2>
            <p className="text-gray-600">{selectedItem.description}</p>
          </div>
        )}
      </MainMapNavigation>

      <BaseLayerNavigation
        onBaseItemClick={handleBaseItemClick}
        selectedBaseItem={selectedBaseItem}
      />
    </div>
  );
}
