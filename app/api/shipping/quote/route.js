import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { RATES } from '@/lib/shipping-rates';
import { getPriceQuote } from '@/lib/shipmondo/client';

// Slår leveringspriser op til visning i kurven. Bruger Shipmondos live quote
// (samme kilde som create-intent opkræver efter), med den faste tabel som fallback.
export async function GET(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();

  const { searchParams } = new URL(req.url);
  const rawSize = searchParams.get('size') || 'medium';
  const size = ['small', 'medium', 'large', 'xlarge'].includes(rawSize) ? rawSize : 'medium';
  const fromZip = searchParams.get('from') || undefined;
  const toZip = searchParams.get('to') || undefined;

  const options = await Promise.all(Object.values(RATES).map(async (r) => {
    let price = r.prices[size] ?? r.prices.medium;
    let live = false;
    try {
      const carrier = r.carrier_code === 'pdk' ? 'postnord' : r.carrier_code;
      const serviceType = r.type;
      const quote = await getPriceQuote({
        carrier, service_type: serviceType, size_category: size,
        from_zip: fromZip, to_zip: toZip,
      });
      if (quote?.price_dkk > 0) { price = Math.round(quote.price_dkk * 100) / 100; live = true; }
    } catch {
      // fald tilbage til fast tabel-pris
    }
    return {
      carrier_code: r.carrier_code,
      product_code: r.product_code,
      label:        r.label,
      type:         r.type,
      price_dkk:    price,
      live,
    };
  }));

  const parcelOpts = options.filter(o => o.type === 'parcel_shop').sort((a, b) => a.price_dkk - b.price_dkk);
  const homeOpts   = options.filter(o => o.type === 'home_delivery').sort((a, b) => a.price_dkk - b.price_dkk);

  return NextResponse.json({
    size_category: size,
    parcel_shop:   parcelOpts.length ? { min_price: parcelOpts[0].price_dkk, options: parcelOpts } : null,
    home_delivery: homeOpts.length   ? { min_price: homeOpts[0].price_dkk,   options: homeOpts   } : null,
    min: parcelOpts[0]?.price_dkk,
    max: homeOpts.at(-1)?.price_dkk,
  });
}
