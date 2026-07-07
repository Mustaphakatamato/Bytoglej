import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

// GET-lignende opslag af en invitation ud fra dens token (POST så token ikke
// havner i query-strings/logs). Kører server-side med service role, så accept-
// siden ikke behøver en åben SELECT-policy på institution_invitations.
// Selve token'et er beviset på adgang — derfor kræves ingen login her.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: 'invalid' }, { status: 400 });
  }
  const token = String(body?.token || '').trim();
  if (!token) return NextResponse.json({ status: 'invalid' }, { status: 400 });

  const supa = createServerClient();
  const { data: inv } = await supa
    .from('institution_invitations')
    .select('email, institution_name, accepted_at, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (!inv) return NextResponse.json({ status: 'invalid' });
  if (inv.accepted_at) return NextResponse.json({ status: 'used' });
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ status: 'expired' });
  }

  // Kun de felter accept-siden skal vise — ikke hele rækken.
  return NextResponse.json({
    status: 'valid',
    email: inv.email,
    institution_name: inv.institution_name,
  });
}
