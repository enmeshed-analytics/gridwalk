"use client";
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '../components/sidebar';
import Modal from '../components/modal';
import DeckGL from '@deck.gl/react';
import { Map } from 'react-map-gl';
import { MVTLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer } from '@deck.gl/layers';
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

const LAYER_NAMES = ['roads', 'buildings'];

const Home: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [activeLayers, setActiveLayers] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [activeFiles, setActiveFiles] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUploadedFileName, setCurrentUploadedFileName] = useState('');
  const [currentUploadedFileContent, setCurrentUploadedFileContent] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileDrop = useCallback((file: File) => {
    setUploadError(null);

    if (!file.name.toLowerCase().endsWith('.json') && !file.name.toLowerCase().endsWith('.geojson')) {
      setUploadError('Please upload a GeoJSON file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        JSON.parse(content); // Validate JSON
        setCurrentUploadedFileName(file.name);
        setCurrentUploadedFileContent(content);
        setIsModalOpen(true);
      } catch (error) {
        setUploadError('Invalid GeoJSON file.');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileDrop(files[0]);
    }
  }, [handleFileDrop]);

  useEffect(() => {
    // Load layers and uploaded files from localStorage on component mount
    try {
      const savedLayers = localStorage.getItem('activeLayers');
      if (savedLayers) {
        setActiveLayers(JSON.parse(savedLayers));
      } else {
        setActiveLayers(['roads']); // Set 'roads' layer active by default
      }

      const savedFiles = localStorage.getItem('uploadedFiles');
      if (savedFiles) {
        setUploadedFiles(JSON.parse(savedFiles));
      }

      const savedActiveFiles = localStorage.getItem('activeFiles');
      if (savedActiveFiles) {
        setActiveFiles(JSON.parse(savedActiveFiles));
      }
    } catch (error) {
      console.error('Error loading data from localStorage:', error);
      // Set default values if there's an error
      setActiveLayers(['roads']);
      setUploadedFiles([]);
      setActiveFiles([]);
    }
  }, []);

  const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(`Error setting ${key} in localStorage:`, error);
    }
  };

  const safeGetItem = (key: string, defaultValue: any = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error getting ${key} from localStorage:`, error);
      return defaultValue;
    }
  };

  const mvtLayer = useMemo(() => new MVTLayer({
    id: 'mvt',
    data: `/api/tiles/{z}/{x}/{y}?layers=${activeLayers.join(',')}`,
    maxRequests: 20,
    minZoom: 0,
    maxZoom: 23,
    getLineColor: [192, 192, 192],
    getFillColor: [140, 170, 180],
    getLineWidth: 1,
    lineWidthMinPixels: 1,
    pickable: true,
    renderSubLayers: (props) => {
      console.log(props.data.lines)
      return new GeoJsonLayer({
        ...props,
        getLineColor: (f) => ['motorway', 'primary', 'trunk', 'cycleway'].includes(f.properties.highway) ? [236, 183, 83] : [192, 192, 192],
        getFillColor: [140, 170, 180],
        getLineWidth: (f) => ['motorway', 'primary', 'trunk'].includes(f.properties.highway) ? 15 : 3,
        lineWidthMinPixels: 1,
      });
    }
  }), [activeLayers]);

  const renderTooltip = () => {
    if (!hoverInfo || !hoverInfo.object) return null;
    const { x, y, object } = hoverInfo;
    return (
      <div className="absolute z-10 bg-white dark:bg-gray-800 p-2 rounded shadow-md" style={{left: x, top: y}}>
        <p className="text-sm font-semibold">{object.properties?.name || 'Unnamed Feature'}</p>
      </div>
    );
  };

  const handleFileUpload = (file: File) => {
    setUploadError(null);

    if (!file.name.toLowerCase().endsWith('.json') && !file.name.toLowerCase().endsWith('.geojson')) {
      setUploadError('Please upload a GeoJSON file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        JSON.parse(content); // Validate JSON
        setCurrentUploadedFileName(file.name);
        setCurrentUploadedFileContent(content);
        setIsModalOpen(true);
      } catch (error) {
        setUploadError('Invalid GeoJSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleLayerNameConfirm = (layerName: string) => {
    try {
      const jsonData = JSON.parse(currentUploadedFileContent);
      safeSetItem(`file:${layerName}`, JSON.stringify(jsonData));
      setUploadedFiles(prev => {
        const updatedFiles = [...prev, layerName];
        safeSetItem('uploadedFiles', JSON.stringify(updatedFiles));
        return updatedFiles;
      });
    } catch (error) {
      console.error('Error parsing GeoJSON file:', error);
      setUploadError('Error saving file. Please try again.');
    }
    setIsModalOpen(false);
    setCurrentUploadedFileName('');
    setCurrentUploadedFileContent('');
  };

  const handleFileDelete = (fileName: string) => {
    try {
      localStorage.removeItem(`file:${fileName}`);
    } catch (error) {
      console.error(`Error removing ${fileName} from localStorage:`, error);
    }
    setUploadedFiles(prev => {
      const updatedFiles = prev.filter(file => file !== fileName);
      safeSetItem('uploadedFiles', JSON.stringify(updatedFiles));
      return updatedFiles;
    });
    setActiveFiles(prev => prev.filter(file => file !== fileName));
  };

  const handleFileToggle = (fileName: string, isActive: boolean) => {
    setActiveFiles(prev => {
      const updatedFiles = isActive
        ? [...prev, fileName]
        : prev.filter(file => file !== fileName);
      safeSetItem('activeFiles', JSON.stringify(updatedFiles));
      return updatedFiles;
    });
  };

  const handleLayerToggle = (updatedLayers: string[]) => {
    setActiveLayers(updatedLayers);
    safeSetItem('activeLayers', JSON.stringify(updatedLayers));
  };

  const geoJsonLayers = useMemo(() =>
    activeFiles.map(fileName => {
      const geoJsonData = safeGetItem(`file:${fileName}`, {});
      return new GeoJsonLayer({
        id: `geojson-${fileName}`,
        data: geoJsonData,
        pickable: true,
        stroked: false,
        filled: true,
        lineWidthScale: 20,
        lineWidthMinPixels: 2,
        getFillColor: [160, 160, 180, 200],
        getLineColor: [255, 160, 180, 200],
        getPointRadius: 100,
        getLineWidth: 1,
      });
    }),
  [activeFiles]);

  return (
    <div 
      className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onLayerToggle={handleLayerToggle}
        onFileUpload={handleFileUpload}
        onFileDelete={handleFileDelete}
        onFileToggle={handleFileToggle}
        activeLayers={activeLayers}
        layerNames={LAYER_NAMES}
        uploadedFiles={uploadedFiles}
        activeFiles={activeFiles}
        uploadError={uploadError}
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
          layers={[mvtLayer, ...geoJsonLayers]}
          getTooltip={({object}) => object && `${object.properties.name || 'Unnamed Feature'}`}
        >
          <Map
            mapLib={maplibreglTyped}
            mapStyle={{version: 8, sources: {}, layers: []}}
          />
          {renderTooltip()}
        </DeckGL>
      </main>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleLayerNameConfirm}
        defaultLayerName={currentUploadedFileName || ''}
      />
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <p className="text-xl font-bold">Drop GeoJSON file here</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
