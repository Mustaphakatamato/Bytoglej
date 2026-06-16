import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

export const maxDuration = 30;

const CATEGORY_KEYS = [
  'books','puzzles','board-games','plush-small','plush-large','wooden-toys',
  'plastic-toys-small','plastic-toys-medium','plastic-toys-large','construction-toys',
  'outdoor-toys','ride-on-toys','electronic-toys','children-furniture','baby-equipment',
  'musical-instruments','sports-equipment','costumes-roleplay','art-craft-supplies','other',
];
const AGE_GROUPS = ['0-1 år','1-3 år','3-6 år','6-10 år','10+ år','Alle aldre'];
const URGENCY_KEYS = ['haster','måneden','ingen'];
const CONDITIONS = ['Ny','Meget god','God','Acceptabel'];

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY ikke konfigureret' }, { status: 500 });
  }

  try {
    const { query } = await req.json();
    if (!query?.trim()) return NextResponse.json({ error: 'Ingen tekst' }, { status: 400 });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `Du er assistent for en dansk markedsplads for institutioner (børnehaver, skoler, vuggestuer) der bytter og sælger legetøj.

En institution har skrevet fri tekst om hvad de leder efter. Udtræk strukturerede oplysninger til et "søges"-opslag.

Tilgængelige kategorier: ${CATEGORY_KEYS.join(', ')}
Tilgængelige aldersgrupper: ${AGE_GROUPS.join(', ')}
Hastegrad (vælg én): ${URGENCY_KEYS.join(', ')}
Minimum stand (vælg én): ${CONDITIONS.join(', ')}

Returner KUN et JSON-objekt:
{
  "title": "Kort, præcis titel — maks 60 tegn, UDEN 'Søges:' foran",
  "description": "2-3 sætninger der beskriver hvad institutionen leder efter, stand-krav, og eventuelle præferencer. Professionel, venlig tone.",
  "category": "en kategori-nøgle fra listen",
  "age_group": "en aldersgruppe fra listen",
  "urgency": "en hastegrad-nøgle fra listen",
  "condition": "minimum acceptable stand fra listen"
}

Regler:
- title: Altid på dansk, vær specifik, skriv IKKE "Søges:" foran
- description: Naturlig dansk, inkluder relevante detaljer fra brugerens tekst
- category: Vælg den mest relevante kategori
- age_group: Vælg ud fra kontekst, standard "3-6 år" hvis uklart
- urgency: "ingen" medmindre det er klart angivet
- condition: "God" medmindre andet er angivet
- Ingen markdown, kun JSON

Institutionens tekst: "${query}"`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 300,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = completion.choices[0].message.content.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'AI-svar kunne ikke fortolkes' }, { status: 500 });

    let result;
    try { result = JSON.parse(jsonMatch[0]); }
    catch { return NextResponse.json({ error: 'AI-svar kunne ikke fortolkes' }, { status: 500 }); }

    // Validate and sanitize
    if (!CATEGORY_KEYS.includes(result.category)) result.category = '';
    if (!AGE_GROUPS.includes(result.age_group)) result.age_group = '3-6 år';
    if (!URGENCY_KEYS.includes(result.urgency)) result.urgency = 'ingen';
    if (!CONDITIONS.includes(result.condition)) result.condition = 'God';

    // Log til fine-tuning — fire-and-forget
    let logId = null;
    try {
      const supa = createServerClient();
      const { data: logRow } = await supa.from('ai_scan_logs').insert({
        user_id: user.id,
        scan_type: 'fill-soges',
        model_used: 'llama-3.1-8b-instant',
        input_query: query,
        ai_raw_response: result,
        ai_title: result.title || null,
        ai_description: result.description || null,
        ai_category: result.category || null,
        ai_condition: result.condition || null,
        ai_age_group: result.age_group || null,
      }).select('id').single();
      logId = logRow?.id || null;
    } catch (e) {
      console.error('ai_scan_logs insert fejl:', e.message);
    }

    return NextResponse.json({ ...result, log_id: logId });

  } catch (e) {
    console.error('fill-soges error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
