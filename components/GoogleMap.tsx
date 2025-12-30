import React, { useEffect, useRef } from 'react';
import { LatLng } from '../types';

interface MapProps {
  center: LatLng;
  zoom?: number;
  markers?: { position: LatLng; title: string; icon?: string; opacity?: number; className?: string }[];
  path?: LatLng[];
  className?: string;
  onMapClick?: (location: LatLng) => void;
  onMouseMove?: (location: LatLng) => void;
  onMouseOut?: () => void;
}

const GoogleMap: React.FC<MapProps> = ({ 
  center, 
  zoom = 13, 
  markers = [], 
  path = [],
  className = "",
  onMapClick,
  onMouseMove,
  onMouseOut
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersLayerGroup = useRef<any>(null);
  const pathLayer = useRef<any>(null);

  // Use refs for callbacks to avoid stale closures in Leaflet event listeners
  const onMapClickRef = useRef(onMapClick);
  const onMouseMoveRef = useRef(onMouseMove);
  const onMouseOutRef = useRef(onMouseOut);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onMouseMoveRef.current = onMouseMove;
    onMouseOutRef.current = onMouseOut;
  }, [onMapClick, onMouseMove, onMouseOut]);

  useEffect(() => {
    if (!mapRef.current) return;

    const L = (window as any).L;
    if (typeof L === 'undefined') return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: true
      }).setView([center.lat, center.lng], zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstance.current);

      L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.current);
      markersLayerGroup.current = L.layerGroup().addTo(mapInstance.current);

      // Map click listener using ref
      mapInstance.current.on('click', (e: any) => {
        if (onMapClickRef.current) {
          onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      // Map mouse move listener using ref
      mapInstance.current.on('mousemove', (e: any) => {
        if (onMouseMoveRef.current) {
          onMouseMoveRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      // Map mouse out listener using ref
      mapInstance.current.on('mouseout', () => {
        if (onMouseOutRef.current) {
          onMouseOutRef.current();
        }
      });
    }
  }, [center, zoom]); // Only depends on initial setup params

  // Marker management
  useEffect(() => {
    const L = (window as any).L;
    if (!mapInstance.current || !markersLayerGroup.current || typeof L === 'undefined') return;

    markersLayerGroup.current.clearLayers();

    markers.forEach(m => {
      const markerOptions: any = { 
        title: m.title,
        opacity: m.opacity ?? 1.0
      };
      
      if (m.icon) {
        markerOptions.icon = L.icon({
          iconUrl: m.icon,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -40],
          className: m.className || ''
        });
      }

      const marker = L.marker([m.position.lat, m.position.lng], markerOptions);
      if (m.title) marker.bindPopup(`<b>${m.title}</b>`);
      markersLayerGroup.current.addLayer(marker);
    });
  }, [markers]);

  // Path management
  useEffect(() => {
    const L = (window as any).L;
    if (!mapInstance.current || typeof L === 'undefined') return;

    if (pathLayer.current) {
      mapInstance.current.removeLayer(pathLayer.current);
    }

    if (path.length > 0) {
      const latLngs = path.map(p => [p.lat, p.lng]);
      pathLayer.current = L.polyline(latLngs, {
        color: '#EF4444',
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(mapInstance.current);
    }
  }, [path]);

  return (
    <div className={`relative w-full h-full bg-gray-200 rounded-xl overflow-hidden shadow-inner ${className}`}>
      <div ref={mapRef} className="w-full h-full" style={{ zIndex: 1 }} />
      {typeof (window as any).L === 'undefined' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-500 p-6 text-center z-20">
          <svg className="w-16 h-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h3 className="text-lg font-semibold">Map Loading...</h3>
          <p className="max-w-xs mt-2 text-sm">Please check your internet connection or Leaflet library status.</p>
        </div>
      )}
    </div>
  );
};

export default GoogleMap;