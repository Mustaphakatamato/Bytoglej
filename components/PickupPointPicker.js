'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PRIMARY, INK, INK2, INK3, PAPER2, PAPER3, GREEN_TINT, FONT } from '@/lib/constants';
import CarrierLogo from '@/components/CarrierLogo';

const CARRIER_COLOR = { pdk: '#005CB9', gls: '#06038D', dao: '#E2001A' };

function fmtKr(n) { return `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`; }

// Vinted-lignende kort-vælger: viser udleveringssteder fra alle carriers på et kort
// + en liste. Køber vælger ét sted (og dermed carrier). Billigste fremhæves.
export default function PickupPointPicker({ points, cheapestCarrier, onConfirm, onClose, addressLabel }) {
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
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

  // Tegn/opdater markers når kortet er klar eller valg ændres
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current) return;
    const L = require('leaflet');
    // Kompakte brandfarvede mærker (Vinted-stil) — kun carrier-mærke, ingen pris.
    const MARK = { pdk: { bg: '#005CB9', txt: 'pn' }, gls: { bg: '#06038D', txt: 'GLS' }, dao: { bg: '#E2001A', txt: 'dao' } };
    markersRef.current.clearLayers();
    points.forEach(p => {
      if (p.lat == null || p.lng == null) return;
      const isSel = p.id === selectedId;
      const m = MARK[p.carrier_code] || { bg: PRIMARY, txt: p.carrier_name };
      const size = isSel ? 30 : 24;
      const html = `<div style="
        width:${size}px;height:${size}px;border-radius:7px;
        background:${m.bg};color:#fff;border:2px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,0.35)${isSel ? `,0 0 0 3px ${PRIMARY}` : ''};
        display:flex;align-items:center;justify-content:center;
        font-family:${FONT};font-weight:800;font-size:${p.carrier_code === 'gls' ? 9 : 10}px;
        letter-spacing:-0.02em;cursor:pointer;transition:all .12s;
        text-transform:${p.carrier_code === 'dao' ? 'lowercase' : 'none'};
      ">${m.txt}</div>`;
      const icon = L.divIcon({ className: '', html, iconAnchor: [size / 2, size / 2] });
      L.marker([p.lat, p.lng], { icon, zIndexOffset: isSel ? 1000 : 0 }).addTo(markersRef.current)
        .on('click', (e) => { L.DomEvent.stopPropagation(e); setSelectedId(p.id); });
    });
  }, [points, selectedId, mounted]);

  // Pan til valgt punkt
  useEffect(() => {
    if (!mapInstanceRef.current || !selected) return;
    mapInstanceRef.current.panTo([selected.lat, selected.lng]);
  }, [selectedId]); // eslint-disable-line

  if (!mounted) return null;

  const sorted = [...points].sort((a, b) => {
    if (a.price == null) return 1; if (b.price == null) return -1;
    return a.price - b.price;
  });

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(22,34,28,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 920, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${PAPER2}` }}>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: INK }}>Vælg et afhentningssted</div>
            {addressLabel && <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 2 }}>Nær {addressLabel}</div>}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: PAPER2, color: INK2, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        {/* Body: liste + kort */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, height: 'min(60vh, 540px)' }}>
          {/* Liste */}
          <div style={{ width: 340, maxWidth: '45%', overflowY: 'auto', borderRight: `1px solid ${PAPER2}`, flexShrink: 0 }}>
            {sorted.length === 0 && (
              <div style={{ padding: 24, fontFamily: FONT, fontSize: 13, color: INK3, textAlign: 'center' }}>Ingen udleveringssteder fundet i området.</div>
            )}
            {sorted.map(p => {
              const isSel = p.id === selectedId;
              const isCheapest = p.carrier_code === cheapestCarrier && p.price != null;
              return (
                <button key={p.id} type="button" onClick={() => setSelectedId(p.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', borderBottom: `1px solid ${PAPER3}`, borderLeft: `3px solid ${isSel ? PRIMARY : 'transparent'}`, background: isSel ? GREEN_TINT : '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CarrierLogo carrier={p.carrier_code} />
                    {isCheapest && <span style={{ fontSize: 10, fontWeight: 800, color: '#059669', background: '#D1FAE5', borderRadius: 99, padding: '1px 7px' }}>BILLIGST</span>}
                    <span style={{ marginLeft: 'auto', fontFamily: FONT, fontWeight: 800, fontSize: 14, color: INK }}>{p.price != null ? fmtKr(p.price) : '—'}</span>
                  </div>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: isSel ? PRIMARY : INK }}>{p.name}</div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{p.address}</div>
                  {p.opening_hours?.[0] && <div style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>🕒 {String(p.opening_hours[0]).replace(/^[A-Za-zæøåÆØÅ]+day: ?/, '')}</div>}
                </button>
              );
            })}
          </div>

          {/* Kort */}
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 360 }} />
          </div>
        </div>

        {/* Footer: bekræft */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${PAPER2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            {selected
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CarrierLogo carrier={selected.carrier_code} />
                  <span style={{ fontFamily: FONT, fontSize: 13, color: INK, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name} · {fmtKr(selected.price)}</span>
                </div>
              : <span style={{ fontFamily: FONT, fontSize: 13, color: INK3 }}>Vælg et sted på kortet eller i listen</span>}
          </div>
          <button type="button" disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
            style={{ flexShrink: 0, padding: '11px 26px', borderRadius: 99, border: 'none', background: selected ? PRIMARY : PAPER3, color: selected ? '#fff' : INK3, fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: selected ? 'pointer' : 'not-allowed' }}>
            Bekræft
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
