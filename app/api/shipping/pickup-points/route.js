import { NextResponse } from 'next/server';
import { listPickupPoints } from '@/lib/shipmondo/client';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const zip_code = searchParams.get('zip') || '2100';
  const carrier  = searchParams.get('carrier') || 'postnord';

  try {
    const points = await listPickupPoints({ zip_code, carrier, limit: 6 });
    return NextResponse.json({ points });
  } catch (e) {
    console.error('[shipping/pickup-points]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
