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
          { type: 'text', text: 'Does this image show a clearly visible human face, or a person where you can identify who they are? Reply yes or no only. Reply NO for: hands, fingers, arms, legs, feet, partial limbs, blurry people in the background, cartoon characters, toys, games, furniture, equipment, food, nature, buildings, animals, or any object. Reply YES only if there is a clearly recognizable human face or full person that would allow identification.' },
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
