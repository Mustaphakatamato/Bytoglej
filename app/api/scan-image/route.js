import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const formData = await req.formData();
    const file = formData.get('image');
    if (!file) return NextResponse.json({ safe: true });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const completion = await groq.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: 'Does this image contain any people, faces, children, or human silhouettes? Answer with only "yes" or "no".' },
        ],
      }],
    });

    const text = completion.choices[0].message.content.toLowerCase().trim();
    return NextResponse.json({ safe: !text.startsWith('yes') });
  } catch (e) {
    console.error('scan-image error:', e.message);
    return NextResponse.json({ safe: true });
  }
}
