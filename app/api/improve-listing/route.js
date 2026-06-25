import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

export async function POST(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const { title, description, type, condition, age_group, tags } = await req.json();
    if (!title && !description) {
      return NextResponse.json({ error: 'Titel eller beskrivelse påkrævet' }, { status: 400 });
    }

    const typeLabel = type === 'køb' ? 'til salg' : type === 'søges' ? 'efterlyses' : 'til bytte';
    const tagList = tags?.length ? tags.join(', ') : 'ingen';

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Du er en tekstassistent på en dansk B2B-markedsplads kaldet byt&leg, hvor institutioner (børnehaver, skoler, SFO'er) køber, sælger og bytter brugt legetøj.

Din eneste opgave er at forbedre sproget i et opslag. Du må ALDRIG:
- Opfinde oplysninger der ikke fremgår af det originale opslag
- Tilføje priser, mål, mærker, årstal eller egenskaber der ikke er nævnt
- Ændre den faktiske betydning af opslaget
- Bruge emojis, udråbstegn eller salgssprog
- Skrive mere end 4 sætninger i beskrivelsen
- Afvige fra det angivne sprog (altid dansk)

Du må GERNE:
- Ret stavefejl og grammatik — brug beskrivelsen som kontekst til at forstå hvad et uklart ord i titlen betyder, og ret det til det korrekte ord (fx "glodser" → "klodser" fordi beskrivelsen nævner "klodser")
- Omformulere uklart sprog til præcist og professionelt dansk
- Strukturere beskrivelsen logisk (stand → indhold → begrundelse)
- Gøre titlen mere konkret og søgbar inden for 60 tegn
- Sikre at titel og beskrivelse er konsistente med hinanden`,
        },
        {
          role: 'user',
          content: `Forbedre dette opslag. Svar KUN med JSON — ingen forklaring.

Opslag:
- Titel: "${title || ''}"
- Beskrivelse: "${description || ''}"
- Type: ${typeLabel}
- Stand: ${condition || 'ukendt'}
- Aldersgruppe: ${age_group || 'ukendt'}
- Kategorier: ${tagList}

Svar med præcis dette JSON-format:
{"title": "...", "description": "..."}`,
        },
      ],
    });

    const json = JSON.parse(completion.choices[0].message.content);
    return NextResponse.json({ title: json.title, description: json.description });
  } catch (e) {
    console.error('improve-listing error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
