import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { WEIGHT_BANDS, CARRIER_LABELS, suggestBand } from '@/lib/shipping-rates';

// Estimerede leveringspriser til visning i opret-opslag.
// Tabel-baseret da live quote kræver fuld afsender/modtager (kun tilgængeligt ved checkout).
export async function GET(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();

  const { searchParams } = new URL(req.url);
  const weight_g = Math.max(0, parseInt(searchParams.get('weight_g') || '0', 10));

  const carriers = Object.entries(WEIGHT_BANDS).map(([carrier, bands]) => ({
    carrier,
    label: CARRIER_LABELS[carrier],
    bands,
    suggested_key: weight_g > 0 ? suggestBand(carrier, weight_g)?.key : null,
  }));

  // Cheapest option overall for the given weight
  const cheapest = carriers
    .flatMap(c => c.bands.map(b => ({ ...b, carrier: c.carrier })))
    .filter(b => weight_g === 0 || weight_g <= b.max_g)
    .sort((a, b) => a.price - b.price)[0] ?? null;

  return NextResponse.json({
    estimate: true,
    weight_g,
    carriers,
    cheapest_key: cheapest?.key ?? null,
    cheapest_price: cheapest?.price ?? null,
  });
}
