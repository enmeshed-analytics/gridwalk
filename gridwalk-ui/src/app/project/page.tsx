// app/page.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MapModal from "./components/mapModal/mapModal";
import { NavItem } from "./components/mapModal/types";

export default function Project() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedItem, setSelectedItem] = useState<NavItem | null>(null);
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

  return (
    <div className="w-full h-screen relative">
      {/* Map Container - Now has left padding for nav */}
      <div className="absolute inset-0 pl-12">
        {" "}
        {/* Changed from pr-16 to pl-16 */}
        <div ref={mapContainer} className="h-full w-full" />
      </div>

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
    </div>
  );
}
