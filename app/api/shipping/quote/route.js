import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { getPriceQuote, isMockMode } from '@/lib/shipmondo/client';

const PARCEL_SHOP_CARRIERS = [
  { carrier: 'postnord', service_type: 'service_point', label: 'PostNord pakkeshop' },
  { carrier: 'dao',      service_type: 'parcel_shop',   label: 'DAO pakkeshop'      },
  { carrier: 'gls',      service_type: 'parcel_shop',   label: 'GLS pakkeshop'      },
];
const HOME_DELIVERY_CARRIERS = [
  { carrier: 'postnord', service_type: 'home_delivery', label: 'PostNord hjemlevering' },
  { carrier: 'dao',      service_type: 'home_delivery', label: 'DAO hjemlevering'      },
];

export async function GET(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();

  const { searchParams } = new URL(req.url);
  const size_category = searchParams.get('size') || 'medium';
  const from_zip      = searchParams.get('from_zip') || null;
  const to_zip        = searchParams.get('to_zip')   || null;

  async function cheapest(carriers) {
    const results = await Promise.allSettled(
      carriers.map(({ carrier, service_type, label }) =>
        getPriceQuote({ carrier, service_type, size_category, from_zip, to_zip })
          .then(q => ({ ...q, label }))
      )
    );
    const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (!ok.length) return null;
    ok.sort((a, b) => a.price_dkk - b.price_dkk);
    return { min_price: ok[0].price_dkk, options: ok };
  }

  try {
    const [parcelShop, homeDelivery] = await Promise.all([
      cheapest(PARCEL_SHOP_CARRIERS),
      cheapest(HOME_DELIVERY_CARRIERS),
    ]);

    return NextResponse.json({
      mock: isMockMode,
      size_category,
      parcel_shop:   parcelShop,
      home_delivery: homeDelivery,
      // legacy fields for backwards compat
      min: parcelShop?.min_price ?? homeDelivery?.min_price,
      max: homeDelivery?.options?.at(-1)?.price_dkk ?? parcelShop?.options?.at(-1)?.price_dkk,
    });
  } catch (e) {
    console.error('[shipping/quote]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
