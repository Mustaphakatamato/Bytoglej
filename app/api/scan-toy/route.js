import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server'; // bruges til prissammenligning
import { visionAnalyze, visionConfigured } from '@/lib/vision';
import { CATEGORIES } from '@/lib/categories';

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

// Afledt fra den fælles kategori-definition, så scan-toy altid er i sync med
// formularen (kategori-nøgler + tilhørende underkategori-tekster).
const CATEGORY_KEYS = CATEGORIES.map(c => c.key);
const SUBCATEGORIES = Object.fromEntries(CATEGORIES.map(c => [c.key, c.sub || []]));
const SUBCAT_LINES = CATEGORIES
  .filter(c => (c.sub || []).length)
  .map(c => `  ${c.key}: ${c.sub.join(' | ')}`)
  .join('\n');

export async function POST(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();
  if (!visionConfigured()) {
    return NextResponse.json({ error: 'AI-scanning er ikke konfigureret' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('image');
    if (!file) return NextResponse.json({ error: 'Intet billede' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const prompt = `Du er en assistent der hjælper med at oprette annoncer for danske institutioner (vuggestuer, børnehaver, skoler).

Returner KUN et JSON-objekt med følgende felter:
- has_person: true hvis billedet viser en ÆGTE, levende person (synligt ansigt eller tydeligt genkendelig krop, uanset orientering) — false ellers. Tegnefigurer, tegninger, dukker, actionfigurer, bamser, eller personer trykt på legetøj/bøger/emballage tæller IKKE som person.
- person_reason: kort dansk grund på max 80 tegn (kun hvis has_person er true)
- needs_review: true hvis billedet IKKE tydeligt viser legetøj eller institutions-udstyr (fx mad, landskaber, dyr, mennesker, tilfældige genstande) — false ellers
- reject_reason: kort dansk forklaring på max 80 tegn (kun hvis needs_review er true, ellers udelad feltet)
- title: kort dansk titel på max 60 tegn (bedste gæt selv ved usikre billeder)
- category: vælg ÉN nøgle fra: ${CATEGORY_KEYS.join(', ')}
- subcategory: vælg ÉN underkategori-tekst der hører til den valgte category, og kopiér teksten PRÆCIST fra listen under "Underkategorier" nedenfor. Vælg den mest passende; hvis ingen passer godt, brug den mest generelle/"Diverse" for den category. Brug "" hvis category er "other" og intet passer.
- condition: vælg ÉN: "Ny", "God stand", "Brugt", "Slidte"
- age_group: vælg ÉN: "0-2 år", "3-6 år", "6-10 år", "10+ år", "Alle aldre"
- description: 2-3 sætninger på dansk der beskriver genstanden direkte og konkret (hvad det er, indhold/antal, materiale og hvad det egner sig til). Skriv det som en færdig annoncetekst i sælgers egen stemme — bestemt og uden forbehold. Brug ALDRIG tvivls- eller gætteformuleringer som "ser ud til", "ser ud som om", "virker", "lader til", "umiddelbart", "muligvis" eller "sandsynligvis". Gæt ikke på stand i teksten (sælger vælger selv stand) — beskriv genstanden faktuelt i stedet
- visual_description: 1-2 sætninger der KUN beskriver hvad man ser på billedet — genstandstype, hovedfarve(r), materiale, form og evt. tekst/logo/mærke samt distinkte træk. Ingen vurdering af stand, alder eller egnethed. Intet salgssprog.
- price_min: laveste rimelige BRUGTPRIS i danske kroner (heltal)
- price_max: højeste rimelige brugtpris i danske kroner (heltal), skal være ≥ price_min

Underkategorier (vælg subcategory der hører til den valgte category):
${SUBCAT_LINES}

Relevante ting: legetøj, spil, puslespil, bøger, børnemøbler, sportsudstyr, musikinstrumenter, kreativt materiale, legeredskaber, babyudstyr, kostumer.
Sæt needs_review: true for alt andet og giv et bedste gæt på felterne.
Ingen markdown, ingen forklaring — kun JSON.`;

    const text = await visionAnalyze({
      base64, mimeType, prompt,
      json: true,
      maxOutputTokens: 512,
      temperature: 0,
    });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Ugyldigt AI-svar. Prøv igen' }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]);

    if (!CATEGORY_KEYS.includes(parsed.category)) parsed.category = 'other';

    // Validér underkategori mod den valgte kategori (case-insensitivt). Ugyldig → tom.
    const subList = SUBCATEGORIES[parsed.category] || [];
    const wantSub = String(parsed.subcategory || '').trim().toLowerCase();
    parsed.subcategory = subList.find(s => s.toLowerCase() === wantSub) || '';

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

    // Fjern de rå AI-felter fra svaret; returnér det strukturerede resultat.
    const needsReview = !!parsed.needs_review;
    const rejectReason = parsed.reject_reason || null;
    const hasPerson = !!parsed.has_person;
    const personReason = parsed.person_reason || null;
    delete parsed.price_min; delete parsed.price_max;
    delete parsed.needs_review; delete parsed.reject_reason;
    delete parsed.has_person; delete parsed.person_reason;

    // Person-tjek er foldet ind her, så scanning kun bruger ÉT vision-kald
    // (i stedet for et separat scan-image-kald oveni).
    return NextResponse.json({ ...parsed, price, needs_review: needsReview, reject_reason: rejectReason, has_person: hasPerson, person_reason: personReason });
  } catch (e) {
    console.error('scan-toy error:', e.message);
    const msg = String(e?.message || '');
    if (/429|too many requests|resource[_ ]?exhausted|rate limit/i.test(msg)) {
      return NextResponse.json({ error: 'AI-tjenesten er travl lige nu. Vent et øjeblik og prøv igen.' }, { status: 429 });
    }
    return NextResponse.json({ error: 'Noget gik galt. Prøv igen' }, { status: 500 });
  }
}
