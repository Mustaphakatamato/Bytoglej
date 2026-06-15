'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PRIMARY, INK, INK2, INK3, PAPER2, PAPER3, GREEN_TINT, FONT } from '@/lib/constants';
import CarrierLogo from '@/components/CarrierLogo';

const CARRIER_COLOR = { pdk: '#005CB9', gls: '#06038D', dao: '#E2001A' };

function fmtKr(n) { return `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`; }

const DAYS_DA = { Monday: 'Mandag', Tuesday: 'Tirsdag', Wednesday: 'Onsdag', Thursday: 'Torsdag', Friday: 'Fredag', Saturday: 'Lørdag', Sunday: 'Søndag' };
function translateDay(h) {
  return String(h).replace(/^(\w+):/, (_, d) => `${DAYS_DA[d] || d}:`);
}

function fmtDist(m) {
  if (m == null) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

// Kompakt brandfarvet mærke (Vinted-stil). active = valgt eller hover.
const MARK = { pdk: { bg: '#005CB9', txt: 'pn' }, gls: { bg: '#06038D', txt: 'GLS' }, dao: { bg: '#E2001A', txt: 'dao' } };
function makeMarkerIcon(L, p, active) {
  const m = MARK[p.carrier_code] || { bg: PRIMARY, txt: p.carrier_name };
  const size = active ? 30 : 24;
  const html = `<div style="
    width:${size}px;height:${size}px;border-radius:7px;
    background:${m.bg};color:#fff;border:2px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,0.35)${active ? `,0 0 0 3px ${PRIMARY}` : ''};
    display:flex;align-items:center;justify-content:center;
    font-family:${FONT};font-weight:800;font-size:${p.carrier_code === 'gls' ? 9 : 10}px;
    letter-spacing:-0.02em;cursor:pointer;transition:all .12s;
    text-transform:${p.carrier_code === 'dao' ? 'lowercase' : 'none'};
  ">${m.txt}</div>`;
  return L.divIcon({ className: '', html, iconAnchor: [size / 2, size / 2] });
}

// Vinted-lignende kort-vælger: viser udleveringssteder fra alle carriers på et kort
// + en liste sorteret efter afstand. Køber vælger ét sted (og dermed carrier).
export default function PickupPointPicker({ points, cheapestCarrier, buyerCoords, onConfirm, onClose, addressLabel }) {
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const markerByIdRef = useRef({});
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);
  const selectedRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  const selected = points.find(p => p.id === selectedId) || null;
  selectedRef.current = selectedId;

  // Init kort + markers
  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !mapRef.current) return;
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const L = require('leaflet');
    const valid = points.filter(p => p.lat != null && p.lng != null);
    const center = valid.length
      ? [valid.reduce((s, p) => s + p.lat, 0) / valid.length, valid.reduce((s, p) => s + p.lng, 0) / valid.length]
      : [55.67, 12.56];

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, { center, zoom: 12, zoomControl: true, scrollWheelZoom: true });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO', maxZoom: 19 }).addTo(mapInstanceRef.current);
      markersRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      // Fit til alle punkter
      if (valid.length > 1) {
        const b = L.latLngBounds(valid.map(p => [p.lat, p.lng]));
        mapInstanceRef.current.fitBounds(b, { padding: [40, 40] });
      }
      // Kortet initialiseres inde i et modal hvor containeren endnu ikke har sin endelige
      // størrelse → tiles placeres forkert (hvide felter). invalidateSize retter layoutet,
      // når modalen er malet. Kør et par gange for at fange animation/forsinket layout.
      const fixSize = () => mapInstanceRef.current?.invalidateSize();
      requestAnimationFrame(fixSize);
      setTimeout(fixSize, 150);
      setTimeout(fixSize, 400);
    }
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, [mounted]); // eslint-disable-line

  // Tegn markers når kortet er klar / valg ændres. Gemmer refs til hurtig hover-opdatering.
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current) return;
    const L = require('leaflet');
    markersRef.current.clearLayers();
    markerByIdRef.current = {};
    // Køber-markør (blå prik)
    if (buyerCoords?.lat != null) {
      const userHtml = `<div style="width:14px;height:14px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,0.35),0 2px 6px rgba(0,0,0,0.25)"></div>`;
      L.marker([buyerCoords.lat, buyerCoords.lng], { icon: L.divIcon({ className: '', html: userHtml, iconAnchor: [7, 7] }), zIndexOffset: 500 })
        .addTo(markersRef.current).bindTooltip('Din adresse', { direction: 'top' });
    }
    points.forEach(p => {
      if (p.lat == null || p.lng == null) return;
      const isSel = p.id === selectedId;
      const marker = L.marker([p.lat, p.lng], { icon: makeMarkerIcon(L, p, isSel), zIndexOffset: isSel ? 1000 : 0 })
        .addTo(markersRef.current)
        .on('click', (e) => { L.DomEvent.stopPropagation(e); setSelectedId(p.id); })
        .on('mouseover', () => setHoveredId(p.id))
        .on('mouseout', () => setHoveredId(h => h === p.id ? null : h));
      // Lille info-boks ved hover (Vinted-stil): navn + adresse + pris.
      const tip = `<div style="font-family:${FONT};min-width:140px">
        <div style="font-weight:800;font-size:12px;color:${INK}">${p.name}</div>
        <div style="font-size:11px;color:${INK3};margin-top:2px">${p.address}</div>
        ${p.price != null ? `<div style="font-size:11px;font-weight:700;color:${PRIMARY};margin-top:3px">${fmtKr(p.price)}</div>` : ''}
      </div>`;
      marker.bindTooltip(tip, { direction: 'top', offset: [0, -14], opacity: 1, className: 'ltb-pp-tip' });
      markerByIdRef.current[p.id] = marker;
    });
  }, [points, selectedId, mounted, buyerCoords]);

  // Hover: fremhæv kun den berørte markør (uden at gentegne alle).
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = require('leaflet');
    const m = markerByIdRef.current[hoveredId];
    const p = points.find(x => x.id === hoveredId);
    if (m && p) { m.setIcon(makeMarkerIcon(L, p, true)); m.setZIndexOffset(1200); }
    return () => {
      const m2 = markerByIdRef.current[hoveredId];
      const p2 = points.find(x => x.id === hoveredId);
      if (m2 && p2) { m2.setIcon(makeMarkerIcon(L, p2, p2.id === selectedId)); m2.setZIndexOffset(p2.id === selectedId ? 1000 : 0); }
    };
  }, [hoveredId]); // eslint-disable-line

  // Pan til valgt punkt
  useEffect(() => {
    if (!mapInstanceRef.current || !selected) return;
    mapInstanceRef.current.panTo([selected.lat, selected.lng]);
  }, [selectedId]); // eslint-disable-line

  if (!mounted) return null;

  // Sortér efter afstand fra køberens adresse (nærmeste først). Fald tilbage til pris.
  const sorted = [...points].sort((a, b) => {
    if (a.distance_m != null && b.distance_m != null) return a.distance_m - b.distance_m;
    if (a.distance_m != null) return -1;
    if (b.distance_m != null) return 1;
    return (a.price ?? 9e9) - (b.price ?? 9e9);
  });

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(22,34,28,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{`
        .leaflet-tooltip.ltb-pp-tip { background:#fff; border:none; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,0.22); padding:8px 11px; }
        .leaflet-tooltip.ltb-pp-tip:before { border-top-color:#fff; }
      `}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 1240, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${PAPER2}` }}>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: INK }}>Vælg et afhentningssted</div>
            {addressLabel && <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}><span>📍</span>{addressLabel} · sorteret efter afstand</div>}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: PAPER2, color: INK2, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        {/* Body: liste + kort */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, height: 'min(68vh, 640px)' }}>
          {/* Liste */}
          <div style={{ width: 360, maxWidth: '38%', overflowY: 'auto', borderRight: `1px solid ${PAPER2}`, flexShrink: 0 }}>
            {sorted.length === 0 && (
              <div style={{ padding: 24, fontFamily: FONT, fontSize: 13, color: INK3, textAlign: 'center' }}>Ingen udleveringssteder fundet i området.</div>
            )}
            {sorted.map(p => {
              const isSel = p.id === selectedId;
              const isCheapest = p.carrier_code === cheapestCarrier && p.price != null;
              return (
                <button key={p.id} type="button"
                  onClick={() => setSelectedId(p.id)}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(h => h === p.id ? null : h)}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', borderBottom: `1px solid ${PAPER3}`, borderLeft: `3px solid ${isSel ? PRIMARY : 'transparent'}`, background: isSel ? GREEN_TINT : (hoveredId === p.id ? '#FAFAF7' : '#fff'), cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CarrierLogo carrier={p.carrier_code} />
                    {isCheapest && <span style={{ fontSize: 10, fontWeight: 800, color: '#059669', background: '#D1FAE5', borderRadius: 99, padding: '1px 7px' }}>BILLIGST</span>}
                    <span style={{ marginLeft: 'auto', fontFamily: FONT, fontWeight: 800, fontSize: 14, color: INK }}>{p.price != null ? fmtKr(p.price) : '—'}</span>
                  </div>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: isSel ? PRIMARY : INK }}>{p.name}</div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</span>
                    {fmtDist(p.distance_m) && <span style={{ flexShrink: 0, fontWeight: 600 }}>{fmtDist(p.distance_m)}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Kort */}
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 360 }} />
          </div>
        </div>

        {/* Detaljeboks for valgt sted (Vinted-stil) */}
        <div style={{ borderTop: `1px solid ${PAPER2}` }}>
          {selected ? (
            <>
              <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <CarrierLogo carrier={selected.carrier_code} />
                  </div>
                  <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: INK }}>{fmtKr(selected.price)}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: INK2, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📍</span><span style={{ fontWeight: 700 }}>{selected.name}</span>
                  </div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 2, marginLeft: 22 }}>{selected.address}</div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🕒</span><span>Klar til afhentning inden for 1–3 hverdage</span>
                  </div>
                </div>
                <button type="button" onClick={() => onConfirm(selected)}
                  style={{ flexShrink: 0, padding: '11px 26px', borderRadius: 99, border: 'none', background: PRIMARY, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Bekræft
                </button>
              </div>

              {/* Yderligere oplysninger — udfold åbningstider */}
              {selected.opening_hours?.length > 0 && (
                <div style={{ borderTop: `1px solid ${PAPER2}` }}>
                  <button type="button" onClick={() => setExpanded(e => !e)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK }}>
                    Yderligere oplysninger
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {expanded && (
                    <div style={{ padding: '0 20px 16px' }}>
                      <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: INK2, marginBottom: 6 }}>Åbningstider</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {selected.opening_hours.map((h, i) => (
                          <div key={i} style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{translateDay(h)}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '18px 20px', fontFamily: FONT, fontSize: 13, color: INK3, textAlign: 'center' }}>
              Vælg et sted på kortet eller i listen
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
