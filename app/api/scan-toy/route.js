import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

const CATEGORY_KEYS = [
  'books','puzzles','board-games','plush-small','plush-large','wooden-toys',
  'plastic-toys-small','plastic-toys-medium','plastic-toys-large','construction-toys',
  'outdoor-toys','ride-on-toys','electronic-toys','children-furniture','baby-equipment',
  'musical-instruments','sports-equipment','costumes-roleplay','art-craft-supplies','other',
];

export async function POST(req) {
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

    const prompt = `Du er en assistent der hjælper med at oprette legetøjsannoncer for danske institutioner.

Analyser billedet og returner KUN et JSON-objekt (ingen markdown, ingen forklaring) med disse felter:
- title: kort dansk titel (maks 60 tegn, fx "LEGO Duplo kasse med 80 klodser")
- category: vælg ÉN nøgle fra: ${CATEGORY_KEYS.join(', ')}
- condition: vælg ÉN: "Ny", "God stand", "Brugt", "Slidte"
- age_group: vælg ÉN: "0-2 år", "3-6 år", "6-10 år", "10+ år", "Alle aldre"
- description: 2-3 sætninger på dansk om legetøjet (stand, indhold, egnethed)

Eksempel: {"title":"LEGO Duplo basiskasse","category":"construction-toys","condition":"God stand","age_group":"3-6 år","description":"Stor kasse med LEGO Duplo klodser i mange farver. Alle klodser er hele og rene. Velegnet til kreativ leg for de mindste."}`;

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
    if (!CATEGORY_KEYS.includes(parsed.category)) parsed.category = 'other';

    return NextResponse.json(parsed);
  } catch (e) {
    console.error('scan-toy error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
