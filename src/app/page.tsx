"use client";
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '../components/sidebar';
import Modal from '../components/modal';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW_STATE = {
  latitude: 51.5074,
  longitude: -0.1278,
  zoom: 11,
  pitch: 0,
  bearing: 0
};

const LAYER_NAMES = ['roads', 'buildings'];

const Home: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
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
  const [mapError, setMapError] = useState<string | null>(null);
  const prevActiveFilesRef = useRef([]);
  const dragCounter = useRef(0);

  // Initialize map only once
  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) {
      console.error("Map container not found");
      setMapError("Map container not found");
      return;
    }
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'gridwalk-osm-tiles': {
              type: 'vector',
              tiles: [`http://localhost:3000/api/tiles/{z}/{x}/{y}?layers=${activeLayers}`],
              minzoom: 0,
              maxzoom: 20
            }
          },
          layers: [
            {
              id: 'mvt-layer-roads',
              type: 'line',
              source: 'gridwalk-osm-tiles',
              'source-layer': 'roads',
              paint: {}
            },
            {
              id: 'mvt-layer-buildings',
              type: 'fill',
              source: 'gridwalk-osm-tiles',
              'source-layer': 'buildings',
              paint: {}
            }
          ]
        },
        center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
        zoom: INITIAL_VIEW_STATE.zoom
      });
  
      map.current.on('load', () => {
        console.log("Map loaded successfully");
      });
  
      map.current.on('error', (e) => {
        console.error("Map error:", e);
        // TODO: Handle tile server error properly
        //setMapError(`Map error: ${e.error.message}`);
      });
    } catch (error) {
      console.error("Error initializing map:", error);
      setMapError(`Error initializing map: ${error instanceof Error ? error.message : String(error)}`);
    }
  
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Empty dependency array means this effect runs once on mount
  
  // Update tile URL when activeLayers changes
  useEffect(() => {
    if (!map.current) return;
  
    const source = map.current.getSource('gridwalk-osm-tiles');
    if (source) {
      const newTileUrl = `http://localhost:3000/api/tiles/{z}/{x}/{y}?layers=${activeLayers}`;
      source.setTiles([newTileUrl]);
    }
  }, [activeLayers]);

  const updateMapSources = useEffect(() => {
    if (!map.current) return;

    const prevActiveFiles = prevActiveFilesRef.current;

    // Remove layers and sources for files that are no longer active
    prevActiveFiles.forEach(fileName => {
      if (!activeFiles.includes(fileName)) {
        if (map.current.getLayer(`geojson-layer-${fileName}`)) {
          map.current.removeLayer(`geojson-layer-${fileName}`);
        }
        if (map.current.getSource(`geojson-${fileName}`)) {
          map.current.removeSource(`geojson-${fileName}`);
        }
      }
    });

    // Add new sources and layers for active files
    activeFiles.forEach(fileName => {
      if (!map.current.getSource(`geojson-${fileName}`)) {
        const geojsonData = safeGetItem(`file:${fileName}`);
        if (geojsonData) {
          map.current.addSource(`geojson-${fileName}`, {
            type: 'geojson',
            data: geojsonData
          });

          map.current.addLayer({
            id: `geojson-layer-${fileName}`,
            type: 'fill',
            source: `geojson-${fileName}`,
            paint: {
              'fill-color': '#888888',
              'fill-opacity': 0.5,
              'fill-outline-color': 'rgba(0, 255, 0, 1)'
            }
          });
        }
      }
    });

    // Update the ref with the current activeFiles
    prevActiveFilesRef.current = activeFiles;
  }, [activeFiles]);

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
        <div ref={mapContainer} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-100 bg-opacity-75">
            <p className="text-red-700 font-bold">{mapError}</p>
          </div>
        )}
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
