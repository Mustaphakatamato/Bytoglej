import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const CATEGORY_KEYS = [
  'books','puzzles','board-games','plush-small','plush-large','wooden-toys',
  'plastic-toys-small','plastic-toys-medium','plastic-toys-large','construction-toys',
  'outdoor-toys','ride-on-toys','electronic-toys','children-furniture','baby-equipment',
  'musical-instruments','sports-equipment','costumes-roleplay','art-craft-supplies','other',
];

const AGE_GROUPS = ['0-2 år', '3-6 år', '6-10 år', '10+ år', 'Alle aldre'];

export async function POST(req) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  const { query } = await req.json();
  if (!query?.trim()) return NextResponse.json({ error: 'Ingen søgetekst' }, { status: 400 });

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // Step 1: Groq extracts structured search params from natural language
  const prompt = `Du er en søgeassistent for en dansk markedsplads for institutioner (børnehaver, skoler, vuggestuer) der bytter og sælger legetøj og udstyr.

Brugeren har beskrevet hvad de leder efter. Udtræk søgeparametre.

Tilgængelige kategorier: ${CATEGORY_KEYS.join(', ')}
Tilgængelige aldersgrupper: ${AGE_GROUPS.join(', ')}

Returner KUN et JSON-objekt:
{
  "keywords": ["dansk søgeord 1", "dansk søgeord 2"],
  "categories": ["kategori-nøgle"],
  "age_groups": ["aldersgruppe"],
  "max_price": null eller tal,
  "explanation": "Kort dansk sætning om hvad du søger efter"
}

Regler:
- keywords: 2-5 relevante danske ord/varianter (synonymer, relaterede ord)
- categories: 1-3 mest sandsynlige kategorier, eller tom liste hvis usikker
- age_groups: kun hvis klart angivet i beskrivelsen
- max_price: kun hvis pris er nævnt
- Ingen markdown, kun JSON

Brugerens søgning: "${query}"`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 200,
    temperature: 0.1,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = completion.choices[0].message.content.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: 'AI-svar kunne ikke fortolkes' }, { status: 500 });

  let params;
  try { params = JSON.parse(jsonMatch[0]); }
  catch { return NextResponse.json({ error: 'AI-svar kunne ikke fortolkes' }, { status: 500 }); }

  const { keywords = [], categories = [], age_groups = [], max_price } = params;

  // Step 2: Query Supabase with extracted params
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  let q = db.from('listings').select('*').eq('is_active', true).neq('type', 'søges');

  if (categories.length > 0) {
    const validCats = categories.filter(c => CATEGORY_KEYS.includes(c));
    if (validCats.length > 0) q = q.in('category', validCats);
  }

  if (age_groups.length > 0) {
    const validAges = age_groups.filter(a => AGE_GROUPS.includes(a));
    if (validAges.length > 0) q = q.in('age_group', validAges);
  }

  if (max_price) q = q.lte('price', max_price);

  // Keyword ILIKE search across title + description
  if (keywords.length > 0) {
    const orParts = keywords.flatMap(kw => [
      `title.ilike.%${kw}%`,
      `description.ilike.%${kw}%`,
    ]);
    q = q.or(orParts.join(','));
  }

  q = q.order('created_at', { ascending: false }).limit(40);

  const { data: listings, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Score by how many keywords match title (to sort more relevant first)
  const scored = (listings || []).map(l => {
    const hay = `${l.title} ${l.description || ''}`.toLowerCase();
    const score = keywords.filter(kw => hay.includes(kw.toLowerCase())).length;
    return { ...l, _score: score };
  }).sort((a, b) => b._score - a._score);

  return NextResponse.json({
    listings: scored,
    params,
    explanation: params.explanation || `Søger efter: ${query}`,
  });
}
