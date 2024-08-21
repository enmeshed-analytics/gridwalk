"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '../components/sidebar';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl';
import { MVTLayer } from '@deck.gl/geo-layers';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Create a more comprehensive type assertion for maplibregl
const maplibreglTyped: any = {
  Map: maplibregl.Map,
  Marker: maplibregl.Marker,
  Popup: maplibregl.Popup,
  AttributionControl: maplibregl.AttributionControl,
  FullscreenControl: maplibregl.FullscreenControl,
  GeolocateControl: maplibregl.GeolocateControl,
  NavigationControl: maplibregl.NavigationControl,
  ScaleControl: maplibregl.ScaleControl
};

const INITIAL_VIEW_STATE = {
  latitude: 51.5074,
  longitude: -0.1278,
  zoom: 11,
  pitch: 0,
  bearing: 0
};

const INITIAL_LAYERS = ['roads', 'buildings'];

const Home: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [layers, setLayers] = useState<string[]>(INITIAL_LAYERS);

  useEffect(() => {
    // Load layers from localStorage on component mount
    const savedLayers = localStorage.getItem('activeLayers');
    if (savedLayers) {
      setLayers(JSON.parse(savedLayers));
    }
  }, []);

  const mvtLayer = useMemo(() => new MVTLayer({
    id: 'mvt',
    data: `/api/tiles/{z}/{x}/{y}?layers=${layers.join(',')}`,
    maxRequests: 20,
    minZoom: 0,
    maxZoom: 23,
    getLineColor: [192, 192, 192],
    getFillColor: [140, 170, 180],
    getLineWidth: 1,
    lineWidthMinPixels: 1,
    pickable: true,
    onHover: (info: any) => setHoverInfo(info)
  }), [layers]);

  const renderTooltip = () => {
    if (!hoverInfo || !hoverInfo.object) return null;
    const { x, y, object } = hoverInfo;
    return (
      <div className="absolute z-10 bg-white dark:bg-gray-800 p-2 rounded shadow-md" style={{left: x, top: y}}>
        <p className="text-sm font-semibold">{object.properties.name || 'Unnamed Feature'}</p>
        <p className="text-xs">{`osm_id: ${object.properties.osm_id || 'Unknown'}`}</p>
      </div>
    );
  };

  const handleLayerToggle = (updatedLayers: string[]) => {
    setLayers(updatedLayers);
    // Save layers to localStorage
    localStorage.setItem('activeLayers', JSON.stringify(updatedLayers));
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onLayerToggle={handleLayerToggle}
        activeLayers={layers}
      />
      <main className="flex-1 relative">
        <button 
          className="absolute top-4 left-4 z-10 md:hidden text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded-md shadow-md" 
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-6 h-6" />
        </button>
        <DeckGL
          initialViewState={INITIAL_VIEW_STATE}
          controller={true}
          layers={[mvtLayer]}
          style={{width: '100%', height: '100%'}}
        >
          <Map
            mapLib={maplibreglTyped}
            mapStyle={{version: 8, sources: {}, layers: []}}
          />
          {renderTooltip()}
        </DeckGL>
      </main>
    </div>
  );
}

export default Home;
