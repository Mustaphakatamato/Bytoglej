import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { getOfferQuota } from '@/lib/offer-quota';

// Hvor mange tilbud den aktuelle bruger har tilbage i dag.
export async function GET(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();
  try {
    const quota = await getOfferQuota(user);
    return NextResponse.json(quota);
  } catch (e) {
    console.error('[offers/quota] fejl:', e.message);
    return NextResponse.json({ error: 'Kunne ikke hente kvote' }, { status: 500 });
  }
}
