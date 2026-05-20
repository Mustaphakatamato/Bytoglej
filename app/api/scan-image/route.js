import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('image');
    if (!file) return NextResponse.json({ safe: true });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64 } },
      'Does this image contain any people, faces, children, or human silhouettes? Answer with only "yes" or "no".',
    ]);

    const text = result.response.text().toLowerCase().trim();
    return NextResponse.json({ safe: !text.startsWith('yes') });
  } catch (e) {
    console.error('scan-image error:', e.message);
    return NextResponse.json({ safe: true });
  }
}
