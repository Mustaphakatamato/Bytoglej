import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { embedText } from '@/lib/embed';

export const maxDuration = 30;

// Søg med et billede: foto → Groq-beskrivelse (gratis) → gte-small embedding (gratis)
// → pgvector match_listings (gratis). Finder opslag hvis billeder "minder om" søge-fotoet.
export async function POST(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'AI-søgning er ikke konfigureret' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('image');
    if (!file) return NextResponse.json({ error: 'Intet billede' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    // Step 1: Groq beskriver legetøjet på dansk (samme vision-model som ved upload)
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 120,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: 'Beskriv legetøjet/genstanden på dette billede med 1-2 korte danske sætninger (type, materiale, farve, hvad det bruges til). Kun beskrivelsen — ingen indledning.' },
        ],
      }],
    });

    const description = (completion.choices[0]?.message?.content || '').trim();
    if (!description) return NextResponse.json({ error: 'Kunne ikke beskrive billedet — prøv et andet foto' }, { status: 502 });

    // Step 2: embed beskrivelsen og find nærmeste opslag
    const embedding = await embedText(description);
    if (!embedding) return NextResponse.json({ error: 'Kunne ikke behandle billedet' }, { status: 500 });

    const supa = createServerClient();
    const { data: listings, error } = await supa.rpc('match_listings', {
      query_embedding: embedding,
      match_count: 40,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      listings: listings || [],
      description,
      explanation: `Billeder der minder om: ${description}`,
    });
  } catch (e) {
    console.error('ai-image-search error:', e.message);
    return NextResponse.json({ error: 'Noget gik galt — prøv igen' }, { status: 500 });
  }
}
