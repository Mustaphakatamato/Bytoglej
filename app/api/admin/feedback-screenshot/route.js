import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { checkIsAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

// Serverer et feedback-screenshot fra den PRIVATE feedback-screenshots bucket via
// en kortlivet signed URL. Kun admins. Accepterer både en ren objekt-sti og en
// ældre fuld public-URL (ekstraherer stien), så eksisterende feedback-rækker
// stadig kan vises efter bucket'en er gjort privat.
export async function GET(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();
  if (!(await checkIsAdmin(user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const raw = req.nextUrl.searchParams.get('path') || '';
  if (!raw) return NextResponse.json({ error: 'Mangler path' }, { status: 400 });

  // Ekstrahér objekt-sti hvis der er givet en fuld URL.
  const marker = '/feedback-screenshots/';
  const idx = raw.indexOf(marker);
  const objectPath = idx !== -1 ? raw.slice(idx + marker.length) : raw;

  const supa = createServerClient();
  const { data: signed, error } = await supa
    .storage.from('feedback-screenshots')
    .createSignedUrl(objectPath, 300);
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Billede ikke tilgængeligt' }, { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
