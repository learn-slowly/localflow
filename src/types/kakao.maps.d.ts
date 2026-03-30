/* eslint-disable @typescript-eslint/no-namespace */

declare namespace kakao.maps {
  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    setCenter(latlng: LatLng): void;
    getCenter(): LatLng;
    setLevel(level: number, options?: { animate?: boolean; anchor?: LatLng }): void;
    getLevel(): number;
    panTo(latlng: LatLng | LatLngBounds): void;
    setBounds(bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
    getNode(): HTMLElement;
    relayout(): void;
  }

  interface MapOptions {
    center: LatLng;
    level: number;
  }

  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }

  class LatLngBounds {
    constructor(sw?: LatLng, ne?: LatLng);
    extend(latlng: LatLng): void;
  }

  class Polygon {
    constructor(options: PolygonOptions);
    setMap(map: Map | null): void;
    setOptions(options: Partial<PolygonOptions>): void;
    getPath(): LatLng[];
  }

  interface PolygonOptions {
    map?: Map;
    path: LatLng[] | LatLng[][];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
    fillColor?: string;
    fillOpacity?: number;
    zIndex?: number;
  }

  class CustomOverlay {
    constructor(options: CustomOverlayOptions);
    setMap(map: Map | null): void;
    getMap(): Map | null;
    setPosition(position: LatLng): void;
    setContent(content: string | HTMLElement): void;
    setZIndex(zIndex: number): void;
  }

  interface CustomOverlayOptions {
    map?: Map;
    position?: LatLng;
    content?: string | HTMLElement;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
  }

  class InfoWindow {
    constructor(options?: InfoWindowOptions);
    open(map: Map, marker?: any): void;
    close(): void;
    setContent(content: string | HTMLElement): void;
    setPosition(position: LatLng): void;
  }

  interface InfoWindowOptions {
    content?: string | HTMLElement;
    position?: LatLng;
    removable?: boolean;
    zIndex?: number;
  }

  namespace event {
    function addListener(target: any, type: string, handler: (...args: any[]) => void): void;
    function removeListener(target: any, type: string, handler: (...args: any[]) => void): void;
  }

  function load(callback: () => void): void;
}

interface KakaoMapMouseEvent {
  latLng: kakao.maps.LatLng;
  point: { x: number; y: number };
}

interface Window {
  kakao: typeof kakao & { maps: typeof kakao.maps };
}
