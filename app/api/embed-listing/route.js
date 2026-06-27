import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { describeImagesAndEmbed } from '@/lib/describe-images';

export const maxDuration = 60;

// Genererer en visuel beskrivelse af ALLE opslagets billeder (uanset om brugeren
// trykkede "Scan med AI") + en semantisk embedding, og gemmer dem på opslaget.
// Kaldes fire-and-forget efter et opslag oprettes ELLER redigeres. Bruges af
// AI-billedsøgning. `text` er valgfri fallback hvis opslaget ingen billeder har.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  try {
    const { listingId, text } = await req.json();
    if (!listingId) {
      return NextResponse.json({ error: 'listingId kræves' }, { status: 400 });
    }

    const supa = createServerClient();

    // Ejerskabstjek: kun opslagets ejer må regenerere dets søge-metadata (ellers kunne
    // enhver logget-in bruger overskrive et fremmed opslags beskrivelse/embedding).
    const { data: listing } = await supa.from('listings').select('user_id').eq('id', listingId).maybeSingle();
    if (!listing) return NextResponse.json({ error: 'Opslag ikke fundet' }, { status: 404 });
    if (listing.user_id !== user.id) {
      return NextResponse.json({ error: 'Ingen adgang til dette opslag' }, { status: 403 });
    }

    const result = await describeImagesAndEmbed(supa, listingId, text);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

    return NextResponse.json(result);
  } catch (e) {
    console.error('embed-listing error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
