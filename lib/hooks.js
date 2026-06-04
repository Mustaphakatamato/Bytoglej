'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Deterministic shuffle — same seed always gives same order
function shuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns listings sorted smartly:
//   - Listings newer than last visit go first (marked with _isNew: true)
//   - Rest are shuffled each time refreshSeed changes
export function useFeedListings(listings, refreshSeed) {
  const lastVisitRef = useRef(null);

  // Read lastVisit once on mount, then update it
  useEffect(() => {
    try {
      lastVisitRef.current = localStorage.getItem('ltb_lastVisit') || null;
    } catch {}
  }, []);

  const sorted = useMemo(() => {
    const cutoff = lastVisitRef.current;
    const isNew = l => cutoff && l.created_at > cutoff;
    const newOnes = listings.filter(isNew).map(l => ({ ...l, _isNew: true }));
    const rest    = shuffle(listings.filter(l => !isNew(l)), refreshSeed);
    return [...newOnes, ...rest];
    // refreshSeed only changes on explicit user refresh — shuffle is stable otherwise
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, refreshSeed]);

  // Update lastVisit after rendering so next refresh can detect new items
  useEffect(() => {
    if (!listings.length) return;
    const latest = listings[0]?.created_at;
    if (latest) {
      try { localStorage.setItem('ltb_lastVisit', latest); } catch {}
      lastVisitRef.current = latest;
    }
  }, [listings]);

  return sorted;
}

export function useWindowWidth() {
  const [w, setW] = useState(1200);
  useEffect(() => {
    setW(window.innerWidth);
    const fn = () => setW(window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return w;
}

export function useDebounce(val, ms) {
  const [d, setD] = useState(val);
  useEffect(() => { const t = setTimeout(() => setD(val), ms); return () => clearTimeout(t); }, [val, ms]);
  return d;
}

export function useFavs() {
  const [favs, setFavs] = useState([]);
  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem('ltb_favs') || '[]')); } catch { setFavs([]); }
  }, []);
  const toggle = useCallback(id => {
    setFavs(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('ltb_favs', JSON.stringify(next));
      return next;
    });
  }, []);
  return [favs, toggle];
}

export function relTime(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60) return 'nu';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}t`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(ts).toLocaleDateString('da-DK', { day:'numeric', month:'short' });
}

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export async function geocodeAddress(address, zipcode, city) {
  try {
    const q = encodeURIComponent(`${address}, ${zipcode} ${city}, Denmark`);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
    const d = await r.json();
    if (d[0]) return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
  } catch {}
  return null;
}
