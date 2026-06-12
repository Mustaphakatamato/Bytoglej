import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

const BASE_URL = 'https://app.shipmondo.com/api/public/v3';
const API_USER = process.env.SHIPMONDO_API_USER;
const API_KEY  = process.env.SHIPMONDO_API_KEY;
const IS_MOCK  = !API_USER || !API_KEY;

const MOCK_PRICES = {
  parcel_shop:   { small: 45, medium: 59, large: 79, xlarge: 119 },
  home_delivery: { small: 65, medium: 89, large: 119, xlarge: 179 },
};

// Produkter tilgængelige på denne konto (hentet fra GET /products):
const CARRIERS = [
  { carrier_code: 'pdk', product_code: 'PDK_MC',   type: 'parcel_shop',   label: 'PostNord pakkeshop' },
  { carrier_code: 'gls', product_code: 'GLSDK_SD', type: 'parcel_shop',   label: 'GLS pakkeshop'     },
  { carrier_code: 'dao', product_code: 'DAO_STH',  type: 'home_delivery', label: 'DAO hjemlevering'  },
];

const SIZES = {
  small:  { weight: 2000, length: 35, width: 25, height: 20 },
  medium: { weight: 5000, length: 50, width: 35, height: 25 },
  large:  { weight: 15000, length: 60, width: 40, height: 40 },
  xlarge: { weight: 30000, length: 100, width: 60, height: 60 },
};

async function getQuote({ carrier_code, product_code, size_category, from_zip, to_zip }) {
  const encoded = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
  const parcel = SIZES[size_category] ?? SIZES.medium;

  const res = await fetch(`${BASE_URL}/shipments/quote`, {
    method: 'POST',
    headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      own_agreement: false,
      carrier_code,
      product_code,
      sender:   { zip_code: from_zip || '8000', country_code: 'DK' },
      receiver: { zip_code: to_zip   || '2100', country_code: 'DK' },
      parcels:  [{ quantity: 1, ...parcel }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${carrier_code}/${product_code} ${res.status}: ${text.slice(0, 150)}`);
  }

  const data = await res.json();
  // Shipmondo quote response: data.price or data.total_price
  const price_dkk = data.price?.value ?? data.price ?? data.total_price ?? null;
  if (price_dkk == null) throw new Error(`Ingen pris i svar fra ${carrier_code}`);
  return price_dkk;
}

export async function GET(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();

  const { searchParams } = new URL(req.url);
  const size_category = searchParams.get('size') || 'medium';
  const from_zip      = searchParams.get('from_zip') || null;
  const to_zip        = searchParams.get('to_zip')   || null;

  if (IS_MOCK) {
    const ps = MOCK_PRICES.parcel_shop[size_category]   ?? MOCK_PRICES.parcel_shop.medium;
    const hd = MOCK_PRICES.home_delivery[size_category] ?? MOCK_PRICES.home_delivery.medium;
    return NextResponse.json({
      mock: true, size_category,
      parcel_shop:   { min_price: ps, options: [{ carrier_code: 'pdk', label: 'PostNord pakkeshop',    price_dkk: ps }] },
      home_delivery: { min_price: hd, options: [{ carrier_code: 'pdk', label: 'PostNord hjemlevering', price_dkk: hd }] },
      min: ps, max: hd,
    });
  }

  try {
    const results = await Promise.allSettled(
      CARRIERS.map(c =>
        getQuote({ ...c, size_category, from_zip, to_zip })
          .then(price_dkk => ({ ...c, price_dkk }))
      )
    );

    const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);
    if (failed.length) console.warn('[shipping/quote] Fejlede carriers:', failed);

    const parcelOpts = ok.filter(r => r.type === 'parcel_shop').sort((a, b) => a.price_dkk - b.price_dkk);
    const homeOpts   = ok.filter(r => r.type === 'home_delivery').sort((a, b) => a.price_dkk - b.price_dkk);

    return NextResponse.json({
      mock: false, size_category,
      parcel_shop:   parcelOpts.length   ? { min_price: parcelOpts[0].price_dkk,   options: parcelOpts }   : null,
      home_delivery: homeOpts.length     ? { min_price: homeOpts[0].price_dkk,     options: homeOpts }     : null,
      min: parcelOpts[0]?.price_dkk ?? homeOpts[0]?.price_dkk,
      max: homeOpts.at(-1)?.price_dkk ?? parcelOpts.at(-1)?.price_dkk,
    });
  } catch (e) {
    console.error('[shipping/quote]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
