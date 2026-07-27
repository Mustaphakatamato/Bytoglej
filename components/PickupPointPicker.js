'use client';
import 'leaflet/dist/leaflet.css'; // bundles kort-CSS lokalt — uafhængigt af CDN
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PRIMARY, INK, INK2, INK3, PAPER2, PAPER3, GREEN_TINT, FONT } from '@/lib/constants';
import CarrierLogo from '@/components/CarrierLogo';

function fmtKr(n) { return `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`; }

const DAYS_DA = { Monday: 'Mandag', Tuesday: 'Tirsdag', Wednesday: 'Onsdag', Thursday: 'Torsdag', Friday: 'Fredag', Saturday: 'Lørdag', Sunday: 'Søndag' };
function translateDay(h) {
  return String(h).replace(/^(\w+):/, (_, d) => `${DAYS_DA[d] || d}:`);
}
function fmtDist(m) {
  if (m == null) return null;
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

// ── Tile-udbyder ─────────────────────────────────────────────────────────────
// CARTO's basemaps er gratis uden nøgle, men er tiltænkt lav, ikke-kommerciel
// trafik og throttler anonyme klienter uden varsel — det giver et helt gråt kort
// hvor markers stadig tegnes. MapTiler kræver en nøgle, men rate-limiter ikke på
// samme måde. Nøglen sættes i .env.local og på Vercel, aldrig i koden.
// Uden nøgle bruges CARTO, så kortet stadig virker uden opsætning.
// Bemærk tileSize/zoomOffset på MapTiler: deres anbefalede raster-endpoint leverer
// 512×512-tiles, mens Leaflet som udgangspunkt antager 256×256. Uden de to options
// bliver zoom-niveauerne forskudt og labels dobbelt så store. 512 er valgt frem for
// MapTilers 256-variant, fordi det er 4× færre tile-requests pr. viewport.
// Optionen sættes pr. lag — CARTO-fallbacken leverer 256×256.
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const TILES_PRIMARY = MAPTILER_KEY ? {
  url: `https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`,
  attribution: '© <a href="https://www.maptiler.com/copyright/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  options: { tileSize: 512, zoomOffset: -1 },
} : null;
const TILES_FALLBACK = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution: '© OpenStreetMap © CARTO',
  options: {},
};
const TILE_ERRORS_BEFORE_FALLBACK = 4;

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

export default function PickupPointPicker({ points, cheapestCarrier, buyerCoords, onConfirm, onClose, addressLabel }) {
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState('kort');
  const [isMobile, setIsMobile] = useState(false);

  const markerByIdRef = useRef({});
  // mapRef peger altid på det SAMME div-element — aldrig erstattet via sub-komponent
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);
  const resizeObsRef = useRef(null);
  const resizeRafRef = useRef(0);    // coalescer ResizeObserver-kald til én pr. frame
  const tilesRef = useRef(null);     // aktivt tile-lag (kan udskiftes ved fallback)
  const didFallbackRef = useRef(false); // sandt når vi er skiftet til fallback-tiles
  const pointsRef = useRef(points);  // seneste punkter (init fanger ellers tom liste)
  const sizeFixRef = useRef(null);   // størrelses-fix kaldbar fra andre effekter
  const fitRef = useRef(null);       // zoom-til-punkter kaldbar fra andre effekter
  const didFitRef = useRef(false);   // sandt når kortet er zoomet til punkterne mindst én gang
  const retryIvRef = useRef(null);   // retry-interval indtil containeren har reel størrelse
  pointsRef.current = points;        // hold altid seneste punkter (async-ankomst)

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const selected = points.find(p => p.id === selectedId) || null;

  // Init Leaflet-kort (oprettes én gang; størrelse/zoom håndteres robust af fix()).
  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !mapRef.current) return;
    // Leaflet-CSS'en bundles via top-level import — altid til stede ved mount.
    const L = require('leaflet');

    if (!mapInstanceRef.current) {
      const init = pointsRef.current.filter(p => p.lat != null && p.lng != null);
      const center = init.length
        ? [init.reduce((s, p) => s + p.lat, 0) / init.length, init.reduce((s, p) => s + p.lng, 0) / init.length]
        : [55.67, 12.56];
      mapInstanceRef.current = L.map(mapRef.current, { center, zoom: 12, zoomControl: true, scrollWheelZoom: true });

      // Tile-lag med fallback: fejler den primære udbyder gentagne gange (throttling,
      // netværk, blokeret domæne), skiftes der én gang til CARTO frem for at stå
      // tilbage med et gråt kort.
      const addTiles = (cfg) => L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 19, ...cfg.options })
        .addTo(mapInstanceRef.current);
      tilesRef.current = addTiles(TILES_PRIMARY || TILES_FALLBACK);
      if (TILES_PRIMARY) {
        let tileErrors = 0;
        tilesRef.current.on('tileerror', () => {
          if (didFallbackRef.current || ++tileErrors < TILE_ERRORS_BEFORE_FALLBACK) return;
          didFallbackRef.current = true;
          if (tilesRef.current) mapInstanceRef.current?.removeLayer(tilesRef.current);
          tilesRef.current = addTiles(TILES_FALLBACK);
        });
      }
      markersRef.current = L.layerGroup().addTo(mapInstanceRef.current);

      // Sætter eksplicit højde/bredde fra forælderen (Safari resolver ikke altid
      // højden på et position:absolute element) og lader Leaflet genberegne sit
      // viewport. Returnerer true når containeren har reel størrelse.
      // Bevidst UDEN redraw(): den smider alle tiles væk og henter dem forfra, og
      // kaldt fra både retry-intervallet og ResizeObserver'en udløste det en byge
      // af tile-requests under modal-animationen — nok til at ramme et rate-limit.
      // invalidateSize() henter selv de tiles der mangler.
      const sizeFix = () => {
        const map = mapInstanceRef.current, el = mapRef.current;
        if (!map || !el) return false;
        let sized = true;
        const parent = el.parentElement;
        if (parent) {
          const h = parent.clientHeight, w = parent.clientWidth;
          if (h > 0) el.style.height = h + 'px'; else sized = false;
          if (w > 0) el.style.width = w + 'px';
        }
        map.invalidateSize();
        return sized;
      };
      sizeFixRef.current = sizeFix;

      // Zoom til punkterne. Læser ALTID seneste punkter (async-ankomst). Kaldes kun
      // når punkterne ændrer sig og ved første måling — ikke ved hver resize, så
      // brugerens eget pan/zoom ikke bliver overskrevet.
      const fitToPoints = () => {
        const map = mapInstanceRef.current;
        if (!map) return;
        const valid = pointsRef.current.filter(p => p.lat != null && p.lng != null);
        if (valid.length > 1) {
          map.fitBounds(L.latLngBounds(valid.map(p => [p.lat, p.lng])), { padding: [40, 40] });
        } else if (valid.length === 1) {
          map.setView([valid[0].lat, valid[0].lng], 13);
        }
      };
      fitRef.current = fitToPoints;

      // Retry indtil containeren faktisk har størrelse (modal-animation kan tage tid),
      // maks ~3s. Zoomer til punkterne så snart der ér en størrelse at zoome indenfor.
      const sizeThenFit = () => {
        const sized = sizeFix();
        if (sized && !didFitRef.current) { fitToPoints(); didFitRef.current = true; }
        return sized;
      };
      requestAnimationFrame(sizeThenFit);
      let tries = 0;
      retryIvRef.current = setInterval(() => {
        if (sizeThenFit() || ++tries >= 20) { clearInterval(retryIvRef.current); retryIvRef.current = null; }
      }, 150);

      // Observér forælder-wrapperen (konkret flex-størrelse) frem for det absolutte
      // element, da Safari ikke pålideligt rapporterer sidstnævnte. Kun størrelses-
      // fix — coalesced til ét kald pr. frame, så en løbende animation ikke udløser
      // ét invalidateSize pr. observeret ændring.
      if (typeof ResizeObserver !== 'undefined' && mapRef.current?.parentElement) {
        const ro = new ResizeObserver(() => {
          if (resizeRafRef.current) return;
          resizeRafRef.current = requestAnimationFrame(() => { resizeRafRef.current = 0; sizeFix(); });
        });
        ro.observe(mapRef.current.parentElement);
        resizeObsRef.current = ro;
      }
    }
    return () => {
      if (retryIvRef.current) { clearInterval(retryIvRef.current); retryIvRef.current = null; }
      if (resizeRafRef.current) { cancelAnimationFrame(resizeRafRef.current); resizeRafRef.current = 0; }
      if (resizeObsRef.current) { resizeObsRef.current.disconnect(); resizeObsRef.current = null; }
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      tilesRef.current = null; sizeFixRef.current = null; fitRef.current = null;
      didFitRef.current = false; didFallbackRef.current = false;
    };
  }, [mounted]); // eslint-disable-line

  // Tegn/opdater markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current) return;
    const L = require('leaflet');
    markersRef.current.clearLayers();
    markerByIdRef.current = {};
    if (buyerCoords?.lat != null) {
      const html = `<div style="width:14px;height:14px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 3px rgba(59,130,246,0.35),0 2px 6px rgba(0,0,0,0.25)"></div>`;
      L.marker([buyerCoords.lat, buyerCoords.lng], { icon: L.divIcon({ className: '', html, iconAnchor: [7, 7] }), zIndexOffset: 500 })
        .addTo(markersRef.current).bindTooltip('Din adresse', { direction: 'top' });
    }
    points.forEach(p => {
      if (p.lat == null || p.lng == null) return;
      const isSel = p.id === selectedId;
      const marker = L.marker([p.lat, p.lng], { icon: makeMarkerIcon(L, p, isSel), zIndexOffset: isSel ? 1000 : 0 })
        .addTo(markersRef.current)
        .on('click', e => { L.DomEvent.stopPropagation(e); setSelectedId(p.id); })
        .on('mouseover', () => setHoveredId(p.id))
        .on('mouseout', () => setHoveredId(h => h === p.id ? null : h));
      const tip = `<div style="font-family:${FONT};min-width:140px">
        <div style="font-weight:800;font-size:12px;color:${INK}">${p.name}</div>
        <div style="font-size:11px;color:${INK3};margin-top:2px">${p.address}</div>
        ${p.price != null ? `<div style="font-size:11px;font-weight:700;color:${PRIMARY};margin-top:3px">${fmtKr(p.price)}</div>` : ''}
      </div>`;
      marker.bindTooltip(tip, { direction: 'top', offset: [0, -14], opacity: 1, className: 'ltb-pp-tip' });
      markerByIdRef.current[p.id] = marker;
    });
  }, [points, selectedId, mounted, buyerCoords]);

  // Refit når punkterne (eller køber-koordinaten) ankommer asynkront EFTER at
  // kortet er oprettet — ellers står kortet på default-center.
  useEffect(() => {
    if (!mapInstanceRef.current || !sizeFixRef.current) return;
    if (sizeFixRef.current()) { fitRef.current?.(); didFitRef.current = true; }
  }, [points, buyerCoords]); // eslint-disable-line

  // Hover-fremhævning (desktop)
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

  // På mobil oprettes kortet mens kort-fanen kan være skjult (0 størrelse).
  // Genberegn viewport når man skifter til kort-fanen, så tiles tegnes korrekt.
  useEffect(() => {
    if (mobileTab !== 'kort' || !mapInstanceRef.current) return;
    const run = () => {
      if (!sizeFixRef.current?.()) return;
      if (!didFitRef.current) { fitRef.current?.(); didFitRef.current = true; }
    };
    const raf = requestAnimationFrame(run);
    const t = setTimeout(run, 200); // efter tab-overgangen er faldet på plads
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [mobileTab]);

  if (!mounted) return null;

  const sorted = [...points].sort((a, b) => {
    if (a.distance_m != null && b.distance_m != null) return a.distance_m - b.distance_m;
    if (a.distance_m != null) return -1;
    if (b.distance_m != null) return 1;
    return (a.price ?? 9e9) - (b.price ?? 9e9);
  });

  // Liste-rækker (deles)
  const listRows = sorted.length === 0 ? (
    <div style={{ padding: 24, fontFamily: FONT, fontSize: 13, color: INK3, textAlign: 'center' }}>Ingen udleveringssteder fundet.</div>
  ) : sorted.map(p => {
    const isSel = p.id === selectedId;
    const isCheapest = p.carrier_code === cheapestCarrier && p.price != null;
    return (
      <button key={p.id} type="button"
        onClick={() => { setSelectedId(p.id); if (isMobile) setMobileTab('kort'); }}
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
  });

  // Detalje-panel for valgt sted
  function DetailPanel({ fullWidthBtn }) {
    if (!selected) {
      return <div style={{ padding: '16px 20px', fontFamily: FONT, fontSize: 13, color: INK3, textAlign: 'center' }}>Vælg et sted på kortet eller i listen</div>;
    }
    return (
      <>
        <div style={{ padding: '16px 20px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <CarrierLogo carrier={selected.carrier_code} />
              </div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK, marginBottom: 8 }}>{fmtKr(selected.price)}</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 15, marginTop: 1 }}>📍</span>
                <div>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK }}>{selected.name}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: INK3 }}>{selected.address}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>🕒</span>
                <div style={{ fontFamily: FONT, fontSize: 13, color: INK3 }}>Klar til afhentning inden for 1–3 hverdage</div>
              </div>
            </div>
            {!fullWidthBtn && (
              <button type="button" onClick={() => onConfirm(selected)}
                style={{ flexShrink: 0, padding: '11px 26px', borderRadius: 99, border: 'none', background: PRIMARY, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Bekræft
              </button>
            )}
          </div>
          {fullWidthBtn && (
            <button type="button" onClick={() => onConfirm(selected)}
              style={{ marginTop: 14, width: '100%', padding: '15px', borderRadius: 12, border: 'none', background: PRIMARY, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer', boxSizing: 'border-box' }}>
              Vælg dette afhentningssted
            </button>
          )}
        </div>
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
                {selected.opening_hours.map((h, i) => (
                  <div key={i} style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{translateDay(h)}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  // ── FÆLLES map-div — holdes altid i DOM, flyttes aldrig ─────────────────────
  // Synlighed styres via opacity/pointerEvents, ikke display:none,
  // så Leaflet aldrig mister kortets layout-dimensioner.
  const mapDiv = (
    <div
      ref={mapRef}
      style={{
        position: 'absolute', inset: 0,
        opacity: (!isMobile || mobileTab === 'kort') ? 1 : 0,
        pointerEvents: (!isMobile || mobileTab === 'kort') ? 'auto' : 'none',
        transition: 'opacity 0.15s',
      }}
    />
  );

  // ── MOBIL LAYOUT ─────────────────────────────────────────────────────────────
  if (isMobile) {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <style>{`.leaflet-tooltip.ltb-pp-tip{background:#fff;border:none;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.22);padding:8px 11px}.leaflet-tooltip.ltb-pp-tip:before{border-top-color:#fff}`}</style>

        {/* Top-bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px', borderBottom: `1px solid ${PAPER2}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: PAPER2, color: INK, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: INK }}>Vælg et afhentningssted</div>
            {addressLabel && <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {addressLabel}</div>}
          </div>
        </div>

        {/* Kort / Liste tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${PAPER2}`, flexShrink: 0 }}>
          {[['kort', 'Kort'], ['liste', 'Liste']].map(([k, l]) => (
            <button key={k} onClick={() => setMobileTab(k)}
              style={{ flex: 1, padding: '12px', border: 'none', borderBottom: `2px solid ${mobileTab === k ? PRIMARY : 'transparent'}`, background: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 14, color: mobileTab === k ? PRIMARY : INK3, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Indhold — kort og liste deler samme beholder.
            Kortet er altid i DOM (opacity 0/1), listen vises ovenpå ved liste-tab. */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {mapDiv}
          {mobileTab === 'liste' && (
            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#fff' }}>
              {listRows}
            </div>
          )}
        </div>

        {/* Bund: detalje + CTA */}
        <div style={{ borderTop: `1px solid ${PAPER2}`, flexShrink: 0, background: '#fff' }}>
          <DetailPanel fullWidthBtn />
        </div>
      </div>,
      document.body
    );
  }

  // ── DESKTOP LAYOUT ───────────────────────────────────────────────────────────
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(22,34,28,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{`.leaflet-tooltip.ltb-pp-tip{background:#fff;border:none;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.22);padding:8px 11px}.leaflet-tooltip.ltb-pp-tip:before{border-top-color:#fff}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 1240, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${PAPER2}`, flexShrink: 0 }}>
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
            {listRows}
          </div>
          {/* Kort — position:relative wrapper giver mapDiv en målbar størrelse */}
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            {mapDiv}
          </div>
        </div>

        {/* Detalje-panel */}
        <div style={{ borderTop: `1px solid ${PAPER2}`, flexShrink: 0 }}>
          <DetailPanel fullWidthBtn={false} />
        </div>
      </div>
    </div>,
    document.body
  );
}
