import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];

// Uploads a support-chat image via service role (so anonymous visitors can attach
// images too). Returns the public URL. Re-uses the existing 'chat-images' bucket.
export async function POST(req) {
  let form;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Ugyldig upload' }, { status: 400 }); }

  const file = form.get('file');
  const conversationId = String(form.get('conversationId') || 'anon').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64) || 'anon';
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Ingen fil' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Billedet er for stort (maks 8 MB)' }, { status: 400 });
  if (file.type && !OK_TYPES.includes(file.type)) return NextResponse.json({ error: 'Filtypen understøttes ikke' }, { status: 400 });

  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
  const path = `support/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { data, error } = await adminDb.storage.from('chat-images')
    .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true });
  if (error) {
    console.error('[support-upload] fejl:', error.message);
    return NextResponse.json({ error: 'Upload fejlede' }, { status: 500 });
  }

  const { data: pub } = adminDb.storage.from('chat-images').getPublicUrl(data.path || path);
  return NextResponse.json({ url: pub.publicUrl });
}
