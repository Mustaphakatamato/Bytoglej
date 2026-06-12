import { NextResponse } from 'next/server';

const BASE_URL = 'https://app.shipmondo.com/api/public/v3';
const API_USER = process.env.SHIPMONDO_API_USER;
const API_KEY  = process.env.SHIPMONDO_API_KEY;
const IS_MOCK  = !API_USER || !API_KEY;

const MOCK_POINTS = [
  { id: 'pp-001', name: 'Netto Vesterbro',     address: 'Vesterbrogade 45, 1620 København V',              distance_m: 230 },
  { id: 'pp-002', name: 'SuperBrugsen City',   address: 'Vester Farimagsgade 7, 1606 København V',         distance_m: 580 },
  { id: 'pp-003', name: 'Fakta Frederiksberg', address: 'Frederiksberg Allé 12, 1820 Frederiksberg C',     distance_m: 920 },
];

const CARRIER_CODES = { postnord: 'postnord', dao: 'dao', gls: 'gls' };

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const zip_code = searchParams.get('zip') || '2100';
  const carrier  = searchParams.get('carrier') || 'postnord';
  const limit    = parseInt(searchParams.get('limit') || '6', 10);

  if (IS_MOCK) {
    return NextResponse.json({ points: MOCK_POINTS.slice(0, limit).map(p => ({ ...p, carrier })), mock: true });
  }

  try {
    const encoded = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
    const params = new URLSearchParams({
      zip_code,
      country_code: 'DK',
      carrier_code: CARRIER_CODES[carrier] ?? carrier,
      quantity: String(limit),
    });

    const res = await fetch(`${BASE_URL}/service_points?${params}`, {
      headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[pickup-points] Shipmondo fejl:', res.status, text.slice(0, 300));
      return NextResponse.json({ error: `Shipmondo ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const raw = data.service_points ?? data;
    const points = Array.isArray(raw) ? raw.map(p => ({
      id:         p.id ?? p.service_point_id,
      name:       p.name,
      address:    [p.address, p.zipcode ?? p.zip_code, p.city].filter(Boolean).join(', '),
      distance_m: p.distance_meters ?? p.distance ?? null,
      carrier,
    })) : [];

    return NextResponse.json({ points });
  } catch (e) {
    console.error('[pickup-points] Undtagelsesfejl:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
