// THIS NEEDS TO MOVE?
// DECLARE THE TYPES OF THE MAPBOX DRAW LIBRARY HERE

declare module "@mapbox/mapbox-gl-draw" {
  import { IControl, Map as MaplibreMap } from "maplibre-gl";

  export interface DrawOptions {
    displayControlsDefault?: boolean;
    controls?: {
      point?: boolean;
      line_string?: boolean;
      polygon?: boolean;
      trash?: boolean;
      combine_features?: boolean;
      uncombine_features?: boolean;
    };
    defaultMode?: string;
    styles?: unknown[];
  }

  export interface DrawFeatureCollection {
    type: "FeatureCollection";
    features: GeoJSON.Feature[];
  }

  export default class MapboxDraw implements IControl {
    constructor(options?: DrawOptions);

    // IControl implementation
    onAdd(map: MaplibreMap): HTMLElement;
    onRemove(map: MaplibreMap): void;

    // MapboxDraw methods
    add: (geojson: GeoJSON.Feature | GeoJSON.FeatureCollection) => string[];
    get: (id: string) => GeoJSON.Feature | undefined;
    getAll: () => DrawFeatureCollection;
    delete: (ids: string | string[]) => this;
    deleteAll: () => this;
    set: (featureCollection: GeoJSON.FeatureCollection) => string[];
    changeMode: (mode: string, options?: unknown) => this;
    getMode: () => string;
    trash: () => this;
    getSelectedIds: () => string[];
    getSelectedPoints: () => GeoJSON.Feature[];
    getSelected: () => DrawFeatureCollection;
  }
}
