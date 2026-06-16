import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();

  try {
    const formData = await req.formData();
    const file = formData.get('image');
    const ai_reason = formData.get('ai_reason') || 'Person detekteret';
    const institution_name = formData.get('institution_name') || null;

    if (!file) return NextResponse.json({ error: 'Intet billede' }, { status: 400 });

    const { data: record, error: dbError } = await supa
      .from('scan_rejection_logs')
      .insert({ user_id: user.id, institution_name, ai_reason })
      .select()
      .single();

    if (dbError) return NextResponse.json({ error: 'Fejl ved logging' }, { status: 500 });

    const bytes = await file.arrayBuffer();
    const imagePath = `scan-rejections/${record.id}.jpg`;
    const { error: storageError } = await supa.storage
      .from('listing-images')
      .upload(imagePath, Buffer.from(bytes), { contentType: 'image/jpeg', upsert: true });

    if (!storageError) {
      await supa.from('scan_rejection_logs').update({ image_path: imagePath }).eq('id', record.id);
    }

    return NextResponse.json({ ok: true, log_id: record.id });
  } catch (e) {
    console.error('log-scan-rejection error:', e.message);
    return NextResponse.json({ error: 'Fejl' }, { status: 500 });
  }
}
