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
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'auto' } },
          { type: 'text', text: 'Is there a real, living human person with a visible face or clearly identifiable body in this photo? The person may appear at any orientation (upside-down, sideways, rotated). Look carefully at all parts of the image. Reply "YES: [brief reason]" or "NO". Reply NO for: cartoon/animated/illustrated characters, drawings, paintings, printed characters on toys/books/packaging, dolls, action figures, stuffed animals, isolated hands/fingers/arms/legs/feet with NO face visible, blurry background people, shadows, reflections, silhouettes, clothing, furniture, food, animals, buildings. Reply YES if any real human face or identifiable body is visible anywhere in the image, regardless of orientation.' },
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
