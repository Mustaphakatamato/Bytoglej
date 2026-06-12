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
      max_tokens: 3,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'low' } },
          { type: 'text', text: 'Is there a real, living human person visible in this photo? Reply YES or NO only. IMPORTANT: Reply NO for ALL of the following — cartoon characters, animated characters, Disney characters, illustrated characters, drawings, paintings, printed characters on toys/puzzles/books/packaging, dolls, action figures, stuffed animals, partial body parts (hands/fingers/arms/legs/feet), blurry background people, shadows, reflections, silhouettes, clothing without a person, furniture, equipment, food, animals, buildings, nature, or any non-human object. Reply YES ONLY if there is an actual real photograph of a real living human being\'s face or body that could identify them.' },
        ],
      }],
    });

    const text = completion.choices[0].message.content.toLowerCase().trim();
    const hasPeople = text.startsWith('yes');
    return NextResponse.json({ safe: !hasPeople });
  } catch (e) {
    console.error('scan-image error:', e.message);
    return NextResponse.json({ safe: true });
  }
}
