import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req) {
  try {
    const { title, description, type, condition, age_group, tags } = await req.json();
    if (!title && !description) {
      return NextResponse.json({ error: 'Titel eller beskrivelse påkrævet' }, { status: 400 });
    }

    const typeLabel = type === 'køb' ? 'til salg' : type === 'byd' ? 'til bud' : 'til bytte';
    const tagList = tags?.length ? tags.join(', ') : 'ingen';

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Du er ekspert i at skrive korte, præcise opslag til en dansk B2B-markedsplads for institutionslegetøj (børnehaver, skoler, SFO'er).

Forbedre dette opslag. Svar KUN med JSON — ingen forklaring.

Opslag:
- Titel: "${title || ''}"
- Beskrivelse: "${description || ''}"
- Type: ${typeLabel}
- Stand: ${condition || 'ukendt'}
- Aldersgruppe: ${age_group || 'ukendt'}
- Kategorier: ${tagList}

Regler:
- Titlen skal være max 60 tegn, konkret og informativ
- Beskrivelsen skal være 2-4 sætninger, nævne stand, hvad der medfølger og hvorfor det sælges/byttes
- Skriv i en professionel men venlig tone på dansk
- Brug IKKE emojis
- Bevar de faktiske oplysninger — opfind ikke noget nyt

Svar med præcis dette JSON-format:
{"title": "...", "description": "..."}`
      }],
    });

    const raw = message.content[0].text.trim();
    const json = JSON.parse(raw);

    return NextResponse.json({ title: json.title, description: json.description });
  } catch (e) {
    console.error('improve-listing error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
