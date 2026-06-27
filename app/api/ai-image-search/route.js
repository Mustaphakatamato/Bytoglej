import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { embedText } from '@/lib/embed';

export const maxDuration = 30;

// Søg med et billede: foto → Groq-beskrivelse (gratis) → gte-small embedding (gratis)
// → pgvector match_listings (gratis). Finder opslag hvis billeder "minder om" søge-fotoet.
// Åben for alle (kræver ikke login) — kun offentlige, aktive opslag returneres.
export async function POST(req) {
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
      model: 'qwen/qwen3.6-27b', // vision; erstatter Scout (Groq decommission 2026-07-17)
      max_tokens: 120,
      temperature: 0.2,
      reasoning_effort: 'none', // qwen3.6 er en thinking-model — slå reasoning fra for ren beskrivelse
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: 'Beskriv KUN hvad du ser på billedet i 1-2 korte danske sætninger: genstandstype, hovedfarve(r), materiale, form og evt. tekst/logo/mærke samt distinkte træk. Ingen vurdering af stand, alder eller egnethed. Intet salgssprog. Kun beskrivelsen — ingen indledning.' },
        ],
      }],
    });

    const description = (completion.choices[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!description) return NextResponse.json({ error: 'Kunne ikke beskrive billedet. Prøv et andet foto' }, { status: 502 });

    // Step 2: embed beskrivelsen og find nærmeste opslag
    const embedding = await embedText(description);
    if (!embedding) return NextResponse.json({ error: 'Kunne ikke behandle billedet' }, { status: 500 });

    const supa = createServerClient();
    // match_listings bruger en lighedstærskel (absolut bund + relativ margin fra
    // bedste match) og et loft, så kun opslag der faktisk ligner returneres.
    const { data: listings, error } = await supa.rpc('match_listings', {
      query_embedding: embedding,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      listings: listings || [],
      description,
      explanation: `Billeder der minder om: ${description}`,
    });
  } catch (e) {
    console.error('ai-image-search error:', e.message);
    return NextResponse.json({ error: 'Noget gik galt. Prøv igen' }, { status: 500 });
  }
}
