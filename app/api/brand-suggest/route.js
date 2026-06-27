import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { TOY_BRANDS } from '@/lib/toy-brands';

const normalize = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Slå AI op: er det skrevne et reelt legetøjsmærke? Returnér kort note.
async function aiVerdict(brand) {
  if (!process.env.GROQ_API_KEY) return { ai_recognized: null, ai_note: null };
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      max_tokens: 300,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Du vurderer om en tekst er navnet på et reelt legetøjsmærke/-producent (fx LEGO, Playmobil, BRIO, Schleich, Hape).
Svar KUN med JSON: {"recognized": true|false, "note": "..."}.
- "recognized": true hvis du med rimelig sikkerhed kender det som et faktisk legetøjsmærke, ellers false.
- "note": MEGET kort dansk tekst (maks. 12 ord). Hvis recognized=true: fortæl ganske kort hvad mærket er kendt for. Hvis recognized=false: skriv kort hvorfor (fx "ukendt — ligner ikke et kendt mærke").
Gæt aldrig dig til et mærke du ikke kender — så er recognized=false.`,
        },
        { role: 'user', content: `Mærke: "${brand}"` },
      ],
    });
    const json = JSON.parse(completion.choices[0].message.content || '{}');
    return {
      ai_recognized: typeof json.recognized === 'boolean' ? json.recognized : null,
      ai_note: typeof json.note === 'string' ? json.note.slice(0, 160) : null,
    };
  } catch (e) {
    console.error('brand-suggest AI error:', e.message);
    return { ai_recognized: null, ai_note: null };
  }
}

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const { brand_name, listing_id, institution_name } = await req.json();
  const name = (brand_name || '').trim();
  if (!name) return NextResponse.json({ error: 'Mangler mærkenavn' }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: 'Mærkenavn er for langt' }, { status: 400 });

  const norm = normalize(name);

  // Allerede på den kuraterede liste? Så er det ikke et nyt mærke.
  if (TOY_BRANDS.some((b) => normalize(b) === norm)) {
    return NextResponse.json({ ok: true, skipped: 'already_listed' });
  }

  const supa = createServerClient();

  // Allerede foreslået (uanset status)? Idempotent — gør intet.
  const { data: existing } = await supa
    .from('brand_suggestions')
    .select('id, status')
    .eq('normalized_name', norm)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, skipped: 'already_suggested', status: existing.status });
  }

  const { ai_recognized, ai_note } = await aiVerdict(name);

  const { error } = await supa.from('brand_suggestions').insert({
    brand_name: name,
    normalized_name: norm,
    status: 'pending',
    ai_recognized,
    ai_note,
    institution_name: institution_name || null,
    user_id: user.id,
    listing_id: listing_id || null,
  });

  // Unik-constraint kan ramme ved race — behandl som idempotent.
  if (error && error.code !== '23505') {
    console.error('brand-suggest insert error:', error.message);
    return NextResponse.json({ error: 'Kunne ikke gemme forslag' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
