import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

export async function POST(req) {
  if (!await requireAuth(req)) return UNAUTHORIZED();
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ safe: true });

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const formData = await req.formData();
    const file = formData.get('image');
    if (!file) return NextResponse.json({ safe: true });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const completion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 30,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'low' } },
          { type: 'text', text: 'Is there a real, living human person with a visible face or clearly identifiable body visible in this photo? Reply "YES: [brief reason]" or "NO". IMPORTANT: Reply NO for ALL of the following — cartoon characters, animated characters, illustrated characters, drawings, paintings, printed characters on toys/puzzles/books/packaging, dolls, action figures, stuffed animals, hands, fingers, arms, legs, feet (without face), blurry background people, shadows, reflections, silhouettes, clothing without a person, furniture, equipment, food, animals, buildings, nature, or any non-human object. Reply YES ONLY if there is a clearly visible real human face or body that could identify a person.' },
        ],
      }],
    });

    const text = completion.choices[0].message.content.trim();
    const hasPeople = text.toLowerCase().startsWith('yes');
    const reason = hasPeople
      ? text.replace(/^yes[:\s]*/i, '').trim() || 'Ansigt eller person synlig i billedet'
      : null;
    return NextResponse.json({ safe: !hasPeople, reason });
  } catch (e) {
    console.error('scan-image error:', e.message);
    return NextResponse.json({ safe: true });
  }
}
