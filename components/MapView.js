'use client';
import { useEffect, useRef, useState } from 'react';
import { PRIMARY, INK, INK3, PAPER, PAPER2, PAPER3, GREEN_TINT, GREEN_DEEP, TYPE_CFG, FONT } from '@/lib/constants';

const MARKER_COLOR = PRIMARY;

const TILES = {
  map: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '© OpenStreetMap © CARTO',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
  },
};

function PopupCard({ listing, onOpen, onClose }) {
  const imgs = listing.images?.length ? listing.images : [];
  const tc = TYPE_CFG[listing.type] || { label: listing.type, color: INK3, bg: PAPER2 };
  return (
    <div style={{
      background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(22,34,28,0.18)',
      width: 240, overflow: 'hidden', border: `1px solid ${PAPER2}`, fontFamily: FONT,
    }}>
      <div style={{ height: 120, background: imgs.length ? '#ddd' : GREEN_TINT, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {imgs.length
          ? <img src={imgs[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 48, opacity: 0.45 }}>{listing.emoji || '🧸'}</span>
        }
        <button onClick={onClose} style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(22,34,28,0.55)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
        <span style={{ position: 'absolute', top: 8, left: 8, background: tc.bg, color: tc.color, borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{tc.label}</span>
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: INK, lineHeight: 1.3, marginBottom: 4 }}>{listing.title}</div>
        <div style={{ fontSize: 11, color: INK3, marginBottom: 8 }}>{listing.institution_name}{listing.city ? `, ${listing.city}` : ''}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {listing.price
            ? <span style={{ fontWeight: 800, fontSize: 15, color: PRIMARY }}>{listing.price} kr.</span>
            : <span style={{ fontWeight: 700, fontSize: 12, color: INK3 }}>{listing.type === 'byt' ? 'Byttes kun' : 'Afgiv bud'}</span>
          }
          <button onClick={onOpen} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>Åbn →</button>
        </div>
      </div>
    </div>
  );
}

function CityPopup({ listings, onOpen, onClose }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(22,34,28,0.18)',
      width: 260, border: `1px solid ${PAPER2}`, fontFamily: FONT,
      maxHeight: 300, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${PAPER2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: INK }}>{listings[0].city} · {listings.length} opslag</span>
        <button onClick={onClose} style={{ border: 'none', background: 'none', color: INK3, fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0 }}>✕</button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {listings.map(l => {
          const tc = TYPE_CFG[l.type] || { label: l.type, color: INK3, bg: PAPER2 };
          return (
            <div key={l.id} onClick={() => onOpen(l)}
              style={{ padding: '10px 12px', borderBottom: `1px solid ${PAPER3}`, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = GREEN_TINT}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: l.images?.[0] ? '#ddd' : GREEN_TINT, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {l.images?.[0]
                  ? <img src={l.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 18 }}>{l.emoji || '🧸'}</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                  <span style={{ background: tc.bg, color: tc.color, borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{tc.label}</span>
                  {l.price && <span style={{ fontSize: 11, fontWeight: 700, color: PRIMARY }}>{l.price} kr.</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MapView({ listings, onListingClick, listingCoords, userCoords, isMobile }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [satellite, setSatellite] = useState(false);

  // Swap tile layer when satellite toggles
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = require('leaflet');
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    const t = satellite ? TILES.satellite : TILES.map;
    tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19 });
    tileLayerRef.current.addTo(mapInstanceRef.current);
  }, [satellite]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const L = require('leaflet');

    if (!mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        center: [56.0, 10.5], zoom: 7,
        zoomControl: true,
        scrollWheelZoom: true,
      });
      const t = TILES.map;
      tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19 });
      tileLayerRef.current.addTo(mapInstanceRef.current);
      markersRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    setSelected(null);

    // Group by city
    const byCity = {};
    listings.forEach(l => {
      if (!l.city || !listingCoords[l.city]) return;
      if (!byCity[l.city]) byCity[l.city] = [];
      byCity[l.city].push(l);
    });

    Object.entries(byCity).forEach(([city, cityListings]) => {
      const coords = listingCoords[city];
      const count = cityListings.length;

      const markerHtml = count === 1
        ? `<div style="
            background:${MARKER_COLOR};color:#fff;
            border-radius:999px;padding:5px 11px;
            font-size:11px;font-weight:700;white-space:nowrap;
            box-shadow:0 2px 10px rgba(0,0,0,0.22);
            font-family:'Sora',sans-serif;
            border:2px solid rgba(255,255,255,0.7);
            cursor:pointer;
            display:flex;align-items:center;gap:5px;
          ">
            <span>${cityListings[0].emoji || '🧸'}</span>
            <span>${cityListings[0].title.slice(0, 16)}${cityListings[0].title.length > 16 ? '…' : ''}</span>
            ${cityListings[0].price ? `<span style="opacity:0.8">· ${cityListings[0].price} kr.</span>` : ''}
          </div>`
        : `<div style="
            background:${MARKER_COLOR};color:#fff;
            border-radius:999px;padding:6px 13px;
            font-size:12px;font-weight:800;white-space:nowrap;
            box-shadow:0 3px 12px rgba(0,0,0,0.25);
            font-family:'Sora',sans-serif;
            border:2px solid rgba(255,255,255,0.7);
            cursor:pointer;
            display:flex;align-items:center;gap:6px;
          ">
            <span>${count}</span>
            <span style="width:1px;height:12px;background:rgba(255,255,255,0.35);display:inline-block"></span>
            <span>${city}</span>
          </div>`;

      const icon = L.divIcon({ className: '', html: markerHtml, iconAnchor: [0, 0] });

      L.marker([coords.lat, coords.lon], { icon })
        .addTo(layer)
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelected(count === 1
            ? { type: 'single', listing: cityListings[0] }
            : { type: 'city', listings: cityListings }
          );
        });
    });

    // User location marker
    if (userCoords) {
      const userHtml = `<div style="width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,0.35),0 2px 8px rgba(0,0,0,0.2)"></div>`;
      const userIcon = L.divIcon({ className: '', html: userHtml, iconAnchor: [8, 8] });
      L.marker([userCoords.lat, userCoords.lon], { icon: userIcon })
        .addTo(layer)
        .bindTooltip('Din institution', { permanent: false, direction: 'top' });
    }

    map.on('click', () => setSelected(null));
    return () => { map.off('click'); };
  }, [listings, listingCoords, userCoords]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  const hasListingsOnMap = listings.some(l => l.city && listingCoords[l.city]);

  return (
    <div style={{ position: 'relative', height: isMobile ? 500 : 620, borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 24px rgba(22,34,28,0.10)', border: `1px solid ${PAPER2}`, isolation: 'isolate' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Satellite toggle */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 600 }}>
        <button
          onClick={() => setSatellite(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: satellite ? GREEN_DEEP : 'rgba(246,242,234,0.95)',
            color: satellite ? '#fff' : INK,
            border: `1.5px solid ${satellite ? 'transparent' : PAPER3}`,
            borderRadius: 99, padding: '7px 14px',
            fontSize: 12, fontWeight: 700, fontFamily: FONT,
            cursor: 'pointer', backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(22,34,28,0.12)',
            transition: 'all 0.2s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          {satellite ? 'Kortvisning' : 'Satellit'}
        </button>
      </div>

      {/* Popup overlay */}
      {selected && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 999, pointerEvents: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 24 }}>
          <div style={{ pointerEvents: 'auto' }}>
            {selected.type === 'single' && (
              <PopupCard
                listing={selected.listing}
                onOpen={() => { onListingClick?.(selected.listing); setSelected(null); }}
                onClose={() => setSelected(null)}
              />
            )}
            {selected.type === 'city' && (
              <CityPopup
                listings={selected.listings}
                onOpen={(l) => { onListingClick?.(l); setSelected(null); }}
                onClose={() => setSelected(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasListingsOnMap && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(246,242,234,0.7)', backdropFilter: 'blur(2px)', zIndex: 500, pointerEvents: 'none' }}>
          <span style={{ fontSize: 40, marginBottom: 10 }}>📍</span>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, color: INK }}>Ingen opslag med placering</div>
          <div style={{ fontFamily: FONT, fontSize: 13, color: INK3, marginTop: 4 }}>Koordinater hentes — prøv igen om lidt</div>
        </div>
      )}
    </div>
  );
}
