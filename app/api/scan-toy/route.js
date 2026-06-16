import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server'; // bruges til prissammenligning

// Antal sammenlignelige opslag der kræves før vi bruger platform-median frem for AI-estimat.
const MIN_COMPARABLES = 5;

function round5(n) { return Math.max(5, Math.round(n / 5) * 5); }
function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const i = (sortedAsc.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (i - lo);
}

export const maxDuration = 60;

const CATEGORY_KEYS = [
  'books','puzzles','board-games','plush-small','plush-large','wooden-toys',
  'plastic-toys-small','plastic-toys-medium','plastic-toys-large','construction-toys',
  'outdoor-toys','ride-on-toys','electronic-toys','children-furniture','baby-equipment',
  'musical-instruments','sports-equipment','costumes-roleplay','art-craft-supplies','other',
];

export async function POST(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'AI-scanning er ikke konfigureret' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('image');
    if (!file) return NextResponse.json({ error: 'Intet billede' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `Du er en assistent der hjælper med at oprette annoncer for danske institutioner (vuggestuer, børnehaver, skoler).

Returner KUN et JSON-objekt med følgende felter:
- needs_review: true hvis billedet IKKE tydeligt viser legetøj eller institutions-udstyr (fx mad, landskaber, dyr, mennesker, tilfældige genstande) — false ellers
- reject_reason: kort dansk forklaring på max 80 tegn (kun hvis needs_review er true, ellers udelad feltet)
- title: kort dansk titel på max 60 tegn (bedste gæt selv ved usikre billeder)
- category: vælg ÉN nøgle fra: ${CATEGORY_KEYS.join(', ')}
- condition: vælg ÉN: "Ny", "God stand", "Brugt", "Slidte"
- age_group: vælg ÉN: "0-2 år", "3-6 år", "6-10 år", "10+ år", "Alle aldre"
- description: 2-3 sætninger på dansk om genstanden (stand, indhold, egnethed — bedste gæt ved usikre billeder)
- price_min: laveste rimelige BRUGTPRIS i danske kroner (heltal)
- price_max: højeste rimelige brugtpris i danske kroner (heltal), skal være ≥ price_min

Relevante ting: legetøj, spil, puslespil, bøger, børnemøbler, sportsudstyr, musikinstrumenter, kreativt materiale, legeredskaber, babyudstyr, kostumer.
Sæt needs_review: true for alt andet og giv et bedste gæt på felterne.
Ingen markdown, ingen forklaring — kun JSON.`;

    const completion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: prompt },
        ],
      }],
    });

    const text = completion.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Ugyldigt AI-svar — prøv igen' }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]);

    if (!CATEGORY_KEYS.includes(parsed.category)) parsed.category = 'other';

    // ── Prisforslag ────────────────────────────────────────────
    // ≥5 sammenlignelige aktive opslag i kategorien → brug platform-data
    // (25.–75. percentil som interval, median som forslag). Ellers AI-estimat.
    let price = null;
    try {
      const supa = createServerClient();
      const { data: comps } = await supa
        .from('listings')
        .select('price')
        .eq('category', parsed.category)
        .eq('type', 'køb')
        .eq('is_active', true)
        .eq('is_sold', false)
        .not('price', 'is', null)
        .gt('price', 0)
        .limit(300);
      const prices = (comps || []).map(c => Number(c.price)).filter(n => n > 0).sort((a, b) => a - b);

      if (prices.length >= MIN_COMPARABLES) {
        const lo = round5(percentile(prices, 0.25));
        const hi = round5(percentile(prices, 0.75));
        const mid = round5(percentile(prices, 0.5));
        price = {
          basis: 'median',
          comparable_count: prices.length,
          suggested_min: lo,
          suggested_max: Math.max(hi, lo + 5),
          suggested_price: Math.min(Math.max(mid, lo), Math.max(hi, lo + 5)),
        };
      } else {
        const aMin = Number(parsed.price_min), aMax = Number(parsed.price_max);
        if (aMin > 0 && aMax > 0) {
          const lo = round5(Math.min(aMin, aMax));
          const hi = Math.max(round5(Math.max(aMin, aMax)), lo + 5);
          price = {
            basis: 'ai',
            comparable_count: prices.length,
            suggested_min: lo,
            suggested_max: hi,
            suggested_price: round5((lo + hi) / 2),
          };
        }
      }
    } catch (e) {
      console.error('scan-toy pris-forslag fejl:', e.message);
    }

    // Fjern de rå AI-prisfelter fra svaret; returnér det strukturerede price-objekt.
    const needsReview = !!parsed.needs_review;
    const rejectReason = parsed.reject_reason || null;
    delete parsed.price_min; delete parsed.price_max;
    delete parsed.needs_review; delete parsed.reject_reason;

    return NextResponse.json({ ...parsed, price, needs_review: needsReview, reject_reason: rejectReason });
  } catch (e) {
    console.error('scan-toy error:', e.message);
    return NextResponse.json({ error: 'Noget gik galt — prøv igen' }, { status: 500 });
  }
}
