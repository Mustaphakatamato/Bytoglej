import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

const BASE_URL = 'https://app.shipmondo.com/api/public/v3';
const API_USER = process.env.SHIPMONDO_API_USER;
const API_KEY  = process.env.SHIPMONDO_API_KEY;
const IS_MOCK  = !API_USER || !API_KEY;

const MOCK_POINTS = [
  { id: 'pp-001', name: 'Netto Vesterbro',     address: 'Vesterbrogade 45, 1620 København V',          distance_m: 230 },
  { id: 'pp-002', name: 'SuperBrugsen City',   address: 'Vester Farimagsgade 7, 1606 København V',     distance_m: 580 },
  { id: 'pp-003', name: 'Fakta Frederiksberg', address: 'Frederiksberg Allé 12, 1820 Frederiksberg C', distance_m: 920 },
];

export async function GET(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();

  const { searchParams } = new URL(req.url);
  const rawZip      = searchParams.get('zip') || '2100';
  const zipcode     = /^\d{3,4}$/.test(rawZip) ? rawZip : '2100';
  const rawCarrier  = searchParams.get('carrier') || 'postnord';
  const carrier     = ['postnord', 'pdk', 'dao', 'gls'].includes(rawCarrier) ? rawCarrier : 'postnord';
  const limit       = Math.min(Math.max(parseInt(searchParams.get('limit') || '6', 10) || 6, 1), 20);

  if (IS_MOCK) {
    return NextResponse.json({ points: MOCK_POINTS.slice(0, limit).map(p => ({ ...p, carrier })), mock: true });
  }

  try {
    const encoded = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
    const CARRIER_MAP = { postnord: 'pdk', dao: 'dao', gls: 'gls' };
    const params = new URLSearchParams({
      zipcode,
      country_code: 'DK',
      carrier_code: CARRIER_MAP[carrier] ?? carrier,
      quantity: String(limit),
    });

    const res = await fetch(`${BASE_URL}/pickup_points?${params}`, {  // ← '/pickup_points' (ikke '/service_points')
      headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[pickup-points] Shipmondo fejl:', res.status, text.slice(0, 300));
      return NextResponse.json({ error: `Shipmondo ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const raw = Array.isArray(data) ? data : (data.pickup_points ?? data.service_points ?? []);
    const points = raw.map(p => ({
      id:         p.id ?? p.number,
      name:       p.company_name ?? p.name,
      address:    [p.address, p.zipcode, p.city].filter(Boolean).join(', '),
      distance_m: p.distance ?? null,
      carrier,
    }));

    return NextResponse.json({ points });
  } catch (e) {
    console.error('[pickup-points] Fejl:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
