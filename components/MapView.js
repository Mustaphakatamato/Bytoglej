'use client';
import { useEffect, useRef } from 'react';

// Leaflet må KUN loades client-side (ingen SSR)
export default function MapView({ listings, onListingClick, listingCoords }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const L = require('leaflet');
    require('leaflet/dist/leaflet.css');

    if (!mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, { center: [56.0, 10.5], zoom: 7 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstanceRef.current);
      markersRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    listings.forEach(l => {
      const coords = listingCoords[l.city];
      if (!coords) return;
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#2A7D4F;color:#fff;borderRadius:99px;padding:4px 10px;fontSize:11px;fontWeight:700;whiteSpace:nowrap;boxShadow:0 2px 8px rgba(0,0,0,0.2)">${l.emoji||'🧸'} ${l.title.slice(0,18)}</div>`,
        iconAnchor: [0, 0],
      });
      L.marker([coords.lat, coords.lon], { icon })
        .addTo(layer)
        .on('click', () => onListingClick && onListingClick(l));
    });

    return () => {};
  }, [listings, listingCoords]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return <div ref={mapRef} style={{ width:'100%', height:'100%', borderRadius:16 }} />;
}
