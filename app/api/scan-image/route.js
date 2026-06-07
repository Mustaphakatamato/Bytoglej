import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

export async function POST(req) {
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
      max_tokens: 5,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: 'Are there any visible human faces, identifiable people, or children\'s faces in this image? Hands or feet alone do NOT count. Reply with exactly one word: yes or no.' },
        ],
      }],
    });

    const text = completion.choices[0].message.content.toLowerCase().trim();
    const hasPeople = text.includes('yes');
    return NextResponse.json({ safe: !hasPeople });
  } catch (e) {
    console.error('scan-image error:', e.message);
    return NextResponse.json({ safe: false, error: e.message });
  }
}
