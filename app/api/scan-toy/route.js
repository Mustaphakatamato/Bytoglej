import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

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
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('image');
    if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `Du er en assistent der hjælper med at oprette annoncer for danske institutioner (vuggestuer, børnehaver, skoler).

Tjek FØRST: Er billedet relevant for en institutions-annonce? Relevante ting er: legetøj, spil, puslespil, bøger, børnemøbler, sportsudstyr, musikinstrumenter, kreativt materiale, udendørs legeredskaber, babyudstyr, kostumer — altså ting en institution ville sælge eller bytte.

Hvis billedet IKKE er relevant (fx kropsdele, mad, landskaber, dyr, mennesker, tekst, tilfældige genstande der ikke er legetøj/udstyr) — returner KUN: {"rejected":true,"reason":"Billedet ser ikke ud til at indeholde legetøj eller institutions-udstyr"}

Hvis billedet ER relevant — returner KUN et JSON-objekt med:
- title: kort dansk titel (maks 60 tegn)
- category: vælg ÉN nøgle fra: ${CATEGORY_KEYS.join(', ')}
- condition: vælg ÉN: "Ny", "God stand", "Brugt", "Slidte"
- age_group: vælg ÉN: "0-2 år", "3-6 år", "6-10 år", "10+ år", "Alle aldre"
- description: 2-3 sætninger på dansk om genstanden (stand, indhold, egnethed)

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
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid AI response: ' + text }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.rejected) {
      return NextResponse.json({ error: parsed.reason || 'Ikke relevant for en institutions-annonce' }, { status: 422 });
    }

    if (!CATEGORY_KEYS.includes(parsed.category)) parsed.category = 'other';

    return NextResponse.json(parsed);
  } catch (e) {
    console.error('scan-toy error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
