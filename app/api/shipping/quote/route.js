import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

// Shipmondo platform rates 2025/2026 for DK→DK (incl. all surcharges).
// Source: shipmondo.com published rates. Quote API not supported for these carriers.
const RATES = {
  pdk_parcel_shop: {
    // PDK_MC - PostNord Service Point
    label: 'PostNord pakkeshop',
    carrier_code: 'pdk', product_code: 'PDK_MC', type: 'parcel_shop',
    prices: { small: 37.60, medium: 52.50, large: 82.00, xlarge: 135.00 },
  },
  gls_parcel_shop: {
    // GLSDK_SD - GLS ShopDelivery
    label: 'GLS pakkeshop',
    carrier_code: 'gls', product_code: 'GLSDK_SD', type: 'parcel_shop',
    prices: { small: 34.80, medium: 48.00, large: 75.00, xlarge: 125.00 },
  },
  dao_home: {
    // DAO_STH - daoHOME
    label: 'DAO hjemlevering',
    carrier_code: 'dao', product_code: 'DAO_STH', type: 'home_delivery',
    prices: { small: 49.00, medium: 65.00, large: 95.00, xlarge: 155.00 },
  },
};

export async function GET(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();

  const { searchParams } = new URL(req.url);
  const size = searchParams.get('size') || 'medium';

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
