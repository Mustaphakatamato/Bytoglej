import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { RATES } from '@/lib/shipping-rates';

export async function GET(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();

  const { searchParams } = new URL(req.url);
  const rawSize = searchParams.get('size') || 'medium';
  const size = ['small', 'medium', 'large', 'xlarge'].includes(rawSize) ? rawSize : 'medium';

  const options = Object.values(RATES).map(r => ({
    carrier_code: r.carrier_code,
    product_code: r.product_code,
    label:        r.label,
    type:         r.type,
    price_dkk:    r.prices[size] ?? r.prices.medium,
  }));

  const parcelOpts = options.filter(o => o.type === 'parcel_shop').sort((a, b) => a.price_dkk - b.price_dkk);
  const homeOpts   = options.filter(o => o.type === 'home_delivery').sort((a, b) => a.price_dkk - b.price_dkk);

  return NextResponse.json({
    fixed: true,
    size_category: size,
    parcel_shop:   parcelOpts.length ? { min_price: parcelOpts[0].price_dkk, options: parcelOpts } : null,
    home_delivery: homeOpts.length   ? { min_price: homeOpts[0].price_dkk,   options: homeOpts   } : null,
    min: parcelOpts[0]?.price_dkk,
    max: homeOpts.at(-1)?.price_dkk,
  });
}
