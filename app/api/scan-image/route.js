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
          { type: 'text', text: 'Does this image show a human face or a recognizable portrait of a person? Hands, arms, legs, feet, or cartoon/animal characters do NOT count. Only answer yes if a face is clearly visible. Reply with exactly one word: yes or no.' },
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
