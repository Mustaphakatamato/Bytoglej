import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { embedText } from '@/lib/embed';
import { visionAnalyze, visionConfigured } from '@/lib/vision';

export const maxDuration = 30;

// Søg med et billede: foto → vision-beskrivelse (Gemini) → gte-small embedding (gratis)
// → pgvector match_listings (gratis). Finder opslag hvis billeder "minder om" søge-fotoet.
// Åben for alle (kræver ikke login) — kun offentlige, aktive opslag returneres.
export async function POST(req) {
  if (!visionConfigured()) {
    return NextResponse.json({ error: 'AI-søgning er ikke konfigureret' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('image');
    if (!file) return NextResponse.json({ error: 'Intet billede' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    // Step 1: beskriv legetøjet på dansk (samme vision-model som ved upload)
    const description = await visionAnalyze({
      base64, mimeType,
      prompt: 'Beskriv KUN hvad du ser på billedet i 1-2 korte danske sætninger: genstandstype, hovedfarve(r), materiale, form og evt. tekst/logo/mærke samt distinkte træk. Ingen vurdering af stand, alder eller egnethed. Intet salgssprog. Kun beskrivelsen — ingen indledning.',
      maxOutputTokens: 160,
      temperature: 0.2,
    });
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
