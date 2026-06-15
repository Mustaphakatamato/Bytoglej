import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { WEIGHT_BANDS, CARRIER_LABELS, suggestBand, RATES, sizeToLegacy } from '@/lib/shipping-rates';

// Estimerede leveringspriser. Tabel-baseret da live quote kræver fuld afsender/modtager
// (kun tilgængeligt ved checkout via /api/shipping/live-quote).
//
// To forbrugere:
//   - opret-opslag: kalder ?weight_g=... og læser { carriers, cheapest_* } (vægtbånd).
//   - indkøbsvogn:  kalder ?size=... og læser { parcel_shop, home_delivery } (carrier-options).
export async function GET(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();

  const { searchParams } = new URL(req.url);
  const weight_g = Math.max(0, parseInt(searchParams.get('weight_g') || '0', 10));
  const sizeParam = searchParams.get('size'); // vægt-i-gram-streng ELLER legacy-nøgle

  // ── opret-opslag: vægtbånd per carrier ──
  const carriers = Object.entries(WEIGHT_BANDS).map(([carrier, bands]) => ({
    carrier,
    label: CARRIER_LABELS[carrier],
    bands,
    suggested_key: weight_g > 0 ? suggestBand(carrier, weight_g)?.key : null,
  }));
  const cheapestBand = carriers
    .flatMap(c => c.bands.map(b => ({ ...b, carrier: c.carrier })))
    .filter(b => weight_g === 0 || weight_g <= b.max_g)
    .sort((a, b) => a.price - b.price)[0] ?? null;

  // ── indkøbsvogn: carrier-options per type, sorteret billigst først ──
  const legacySize = sizeToLegacy(sizeParam ?? (weight_g || null));
  const options = Object.values(RATES).map(r => ({
    carrier_code: r.carrier_code,
    product_code: r.product_code,
    label:        r.label,
    type:         r.type,
    price_dkk:    r.prices[legacySize] ?? r.prices.medium,
  }));
  const parcelOpts = options.filter(o => o.type === 'parcel_shop').sort((a, b) => a.price_dkk - b.price_dkk);
  const homeOpts   = options.filter(o => o.type === 'home_delivery').sort((a, b) => a.price_dkk - b.price_dkk);

  return NextResponse.json({
    estimate: true,
    weight_g,
    size_category: legacySize,
    // opret-opslag
    carriers,
    cheapest_key: cheapestBand?.key ?? null,
    cheapest_price: cheapestBand?.price ?? null,
    // indkøbsvogn
    parcel_shop:   parcelOpts.length ? { min_price: parcelOpts[0].price_dkk, options: parcelOpts } : null,
    home_delivery: homeOpts.length   ? { min_price: homeOpts[0].price_dkk,   options: homeOpts   } : null,
  });
}
