import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { getPriceQuote } from '@/lib/shipmondo/client';

// Henter udleveringssteder fra ALLE tre carriers (PostNord, GLS, DAO) på én gang,
// med koordinater + pris pr. carrier, til den Vinted-lignende kort-vælger i kurven.
const BASE_URL = process.env.SHIPMONDO_BASE_URL || 'https://app.shipmondo.com/api/public/v3';
const API_USER = process.env.SHIPMONDO_API_USER;
const API_KEY  = process.env.SHIPMONDO_API_KEY;
const IS_MOCK  = !API_USER || !API_KEY;

const CARRIERS = [
  { code: 'pdk', name: 'PostNord' },
  { code: 'gls', name: 'GLS' },
  { code: 'dao', name: 'dao' },
];

const MOCK_POINTS = [
  { id: 'pp-gls-1', carrier_code: 'gls', carrier_name: 'GLS', name: 'Kioskland', address: 'Greve Midtby Center 10b, 2670 Greve', lat: 55.5815, lng: 12.2935, opening_hours: ['Man-Fre: 07-19'], distance_m: 320, price: 43.5 },
  { id: 'pp-pdk-1', carrier_code: 'pdk', carrier_name: 'PostNord', name: 'Netto Greve', address: 'Hundige Strandvej 5, 2670 Greve', lat: 55.5901, lng: 12.2845, opening_hours: ['Man-Søn: 08-21'], distance_m: 540, price: 47.5 },
  { id: 'pp-dao-1', carrier_code: 'dao', carrier_name: 'dao', name: 'Spar Karlslunde', address: 'Karlslunde Centervej 1, 2690 Karlslunde', lat: 55.5602, lng: 12.2210, opening_hours: ['Man-Søn: 07-20'], distance_m: 1200, price: 48.0 },
];

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

async function nominatim(q) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'bytogleg/1.0 (forsendelse)' },
    });
    const d = await r.json();
    if (d?.[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
  } catch { /* best-effort */ }
  return null;
}

async function geocode(address, zip, city) {
  // Fjern etage/dør-suffiks (fx "3. th.", "st. tv.") der ofte forhindrer et match.
  const clean = String(address || '')
    .replace(/,?\s*\d*\.?\s*(sal|tv|th|mf)\.?.*$/i, '')
    .replace(/,\s*\d+\.\s*$/,'')
    .trim();
  // 1) Forsøg fuld (renset) adresse, 2) fald tilbage til postnr + by (centroid).
  if (clean) {
    const hit = await nominatim(`${clean}, ${zip || ''} ${city || ''}, Denmark`);
    if (hit) return hit;
  }
  if (zip || city) {
    const hit = await nominatim(`${zip || ''} ${city || ''}, Denmark`);
    if (hit) return hit;
  }
  return null;
}

async function fetchPoints(carrierCode, zipcode, qty) {
  try {
    const params = new URLSearchParams({ zipcode, country_code: 'DK', carrier_code: carrierCode, quantity: String(qty) });
    const res = await fetch(`${BASE_URL}/pickup_points?${params}`, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${API_USER}:${API_KEY}`).toString('base64') },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data.pickup_points ?? data.service_points ?? []);
  } catch {
    return [];
  }
}

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }
  const rawZip = body.zip || '2100';
  const zip = /^\d{3,4}$/.test(rawZip) ? rawZip : '2100';
  const sizeCategory = body.sizeCategory || 'medium';

  if (IS_MOCK) {
    return NextResponse.json({ points: MOCK_POINTS, cheapest_carrier: 'gls', cheapest_price: 43.5, mock: true });
  }

  const supa = createServerClient();
  const [{ data: seller }, { data: buyer }] = await Promise.all([
    body.sellerName
      ? supa.from('institutions').select('name,address,zipcode,city,email').ilike('name', body.sellerName).maybeSingle()
      : Promise.resolve({ data: null }),
    body.buyerInstitutionId
      ? supa.from('institutions').select('name,address,zipcode,city,email').eq('id', body.buyerInstitutionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const sender   = { name: seller?.name, address: seller?.address, zip: seller?.zipcode, city: seller?.city, email: seller?.email };
  const receiver = { name: buyer?.name,  address: buyer?.address,  zip: buyer?.zipcode,  city: buyer?.city,  email: buyer?.email };

  const perCarrier = await Promise.all(CARRIERS.map(async (c) => {
    const raw = await fetchPoints(c.code, zip, 8);
    if (!raw.length) return [];

    // Pris er flad for DK indenrigs → kvoter én gang for denne carrier (brug første punkt).
    let price = null;
    try {
      const firstId = raw[0].id ?? raw[0].number;
      const q = await getPriceQuote({
        carrier: c.code, service_type: 'parcel_shop', size_category: sizeCategory,
        sender, receiver, service_point_id: firstId,
      });
      price = q?.price_dkk > 0 ? Math.round(q.price_dkk * 100) / 100 : null;
    } catch { /* carrier utilgængelig — udelad pris */ }

    return raw.map(p => ({
      id:            String(p.id ?? p.number),
      carrier_code:  c.code,
      carrier_name:  c.name,
      name:          p.company_name ?? p.name,
      address:       [p.address, p.zipcode, p.city].filter(Boolean).join(', '),
      lat:           p.latitude,
      lng:           p.longitude,
      opening_hours: p.opening_hours ?? [],
      distance_m:    p.distance ?? null,
      price,
    }));
  }));

  const points = perCarrier.flat().filter(p => p.lat != null && p.lng != null);

  // Geokod køberens adresse → beregn afstand til hver shop, så listen kan sortere på nærhed.
  const buyerCoords = await geocode(buyer?.address, buyer?.zipcode || zip, buyer?.city);
  if (buyerCoords) {
    for (const p of points) p.distance_m = haversineM(buyerCoords.lat, buyerCoords.lng, p.lat, p.lng);
  }

  const cheapest = points.filter(p => p.price != null).sort((a, b) => a.price - b.price)[0] ?? null;

  return NextResponse.json({
    points,
    buyer_coords: buyerCoords,
    cheapest_carrier: cheapest?.carrier_code ?? null,
    cheapest_price:   cheapest?.price ?? null,
  });
}
