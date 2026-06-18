import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { embedText } from '@/lib/embed';

export const maxDuration = 30;

// Genererer en semantisk embedding for et opslag og gemmer den i description_embedding.
// Kaldes fire-and-forget efter et opslag er oprettet. Embeddingen bruges af AI-billedsøgning.
export async function POST(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();

  try {
    const { listingId, text } = await req.json();
    if (!listingId || !text?.trim()) {
      return NextResponse.json({ error: 'listingId og text kræves' }, { status: 400 });
    }

    const embedding = await embedText(text);
    if (!embedding) return NextResponse.json({ error: 'Kunne ikke generere embedding' }, { status: 500 });

    const supa = createServerClient();
    const { error } = await supa
      .from('listings')
      .update({ description_embedding: embedding })
      .eq('id', listingId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('embed-listing error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
