import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { getPriceQuote, isMockMode } from '@/lib/shipmondo/client';

const CARRIERS = [
  { carrier: 'postnord', service_type: 'service_point', label: 'PostNord pakkeshop' },
  { carrier: 'dao',      service_type: 'parcel_shop',   label: 'DAO pakkeshop'      },
  { carrier: 'gls',      service_type: 'parcel_shop',   label: 'GLS pakkeshop'      },
];

export async function GET(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();

  const { searchParams } = new URL(req.url);
  const size_category = searchParams.get('size') || 'medium';
  const from_zip      = searchParams.get('from_zip') || null;
  const to_zip        = searchParams.get('to_zip')   || null;

  try {
    const quotes = await Promise.allSettled(
      CARRIERS.map(({ carrier, service_type, label }) =>
        getPriceQuote({ carrier, service_type, size_category, from_zip, to_zip })
          .then(q => ({ ...q, label }))
      )
    );

    const results = quotes
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (!results.length) {
      return NextResponse.json({ error: 'Ingen fragtpriser tilgængelige' }, { status: 503 });
    }

    const prices = results.map(r => r.price_dkk);
    return NextResponse.json({
      mock: isMockMode,
      size_category,
      min: Math.min(...prices),
      max: Math.max(...prices),
      quotes: results,
    });
  } catch (e) {
    console.error('[shipping/quote]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
