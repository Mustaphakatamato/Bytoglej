import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

// Shipmondo's platform rates (POST /shipments/quote not supported for these carriers).
// Prices based on Shipmondo's published rates for DK→DK.
const FIXED_PRICES = {
  parcel_shop: {
    small:  42,   // 0-2 kg
    medium: 55,   // 2-5 kg
    large:  79,   // 5-15 kg
    xlarge: 115,  // 15-30 kg
  },
  home_delivery: {
    small:  55,
    medium: 72,
    large:  99,
    xlarge: 149,
  },
};

const PARCEL_SHOP_OPTIONS = [
  { carrier_code: 'pdk', product_code: 'PDK_MC',   label: 'PostNord pakkeshop' },
  { carrier_code: 'gls', product_code: 'GLSDK_SD', label: 'GLS pakkeshop'     },
];
const HOME_DELIVERY_OPTIONS = [
  { carrier_code: 'dao', product_code: 'DAO_STH', label: 'DAO hjemlevering' },
];

export async function GET(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();

  const { searchParams } = new URL(req.url);
  const size_category = searchParams.get('size') || 'medium';

  const ps = FIXED_PRICES.parcel_shop[size_category]   ?? FIXED_PRICES.parcel_shop.medium;
  const hd = FIXED_PRICES.home_delivery[size_category] ?? FIXED_PRICES.home_delivery.medium;

  return NextResponse.json({
    mock: false,
    fixed: true,   // prices are fixed estimates, not live quotes
    size_category,
    parcel_shop: {
      min_price: ps,
      options: PARCEL_SHOP_OPTIONS.map(o => ({ ...o, price_dkk: ps, type: 'parcel_shop' })),
    },
    home_delivery: {
      min_price: hd,
      options: HOME_DELIVERY_OPTIONS.map(o => ({ ...o, price_dkk: hd, type: 'home_delivery' })),
    },
    min: ps,
    max: hd,
  });
}
