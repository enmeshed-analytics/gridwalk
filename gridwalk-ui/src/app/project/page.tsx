"use client";
import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MapModal from "./components/mapModal/mapModal";
import { NavItem } from "./components/mapModal/types";
import MapEditNav from "./components/mapModal/mapEditModal";
import { MapEditItem } from "./components/mapModal/types";
import BaseLayerNav from "./components/mapModal/baseLayerModal";
import { BaseEditItem } from "./components/mapModal/types";

export default function Project() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedItem, setSelectedItem] = useState<NavItem | null>(null);
  const [selectedEditItem, setSelectedEditItem] = useState<MapEditItem | null>(
    null,
  );
  const [selectedBaseItem, setSelectedBaseItem] = useState<BaseEditItem | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap Contributors",
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [-74.5, 40],
      zoom: 9,
    });

    mapInstance.addControl(new maplibregl.NavigationControl(), "top-right");
    map.current = mapInstance;

    return () => {
      map.current?.remove();
    };
  }, []);

  const handleNavItemClick = (item: NavItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  // Add this new handler
  const handleEditItemClick = (item: MapEditItem) => {
    setSelectedEditItem(item === selectedEditItem ? null : item);
    // Here you can add your map editing logic based on the selected item
  };

  const handleBaseItemClick = (item: BaseEditItem) => {
    setSelectedBaseItem(item);
    // Here you can add your map style switching logic based on the selected item
    switch (item.id) {
      case "light":
        // Set light blue style
        break;
      case "dark":
        // Set dark blue style
        break;
      case "car":
        // Set purple style
        break;
    }
  };

  return (
    <div className="w-full h-screen relative">
      {/* Map Container */}
      <div className="absolute inset-0 pl-10">
        {" "}
        <div ref={mapContainer} className="h-full w-full" />
      </div>

      {/* Add the MapEditNav component */}
      <MapEditNav
        onEditItemClick={handleEditItemClick}
        selectedEditItem={selectedEditItem}
      />

      {/* Modal Component (includes both nav bar and modal content) */}
      <MapModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedItem(null);
        }}
        onNavItemClick={handleNavItemClick}
        selectedItem={selectedItem}
      >
        {selectedItem && (
          <div>
            <h2 className="text-xl font-bold mb-4">{selectedItem.title}</h2>
            <p className="text-gray-600">{selectedItem.description}</p>
            {/* Modal content based on selectedItem.id */}
          </div>
        )}
      </MapModal>
      <BaseLayerNav
        onBaseItemClick={handleBaseItemClick}
        selectedBaseItem={selectedBaseItem}
      />
    </div>
  );
}
