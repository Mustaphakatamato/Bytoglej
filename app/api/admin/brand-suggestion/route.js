import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();

  const { data: adminRow } = await supa.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminRow) return NextResponse.json({ error: 'Ikke admin' }, { status: 403 });

  const { suggestion_id, action } = await req.json();
  if (!suggestion_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Ugyldige parametre' }, { status: 400 });
  }

  const { data: suggestion } = await supa
    .from('brand_suggestions')
    .select('id, status')
    .eq('id', suggestion_id)
    .maybeSingle();

  if (!suggestion) return NextResponse.json({ error: 'Forslag ikke fundet' }, { status: 404 });
  if (suggestion.status !== 'pending') {
    return NextResponse.json({ error: 'Forslaget er allerede behandlet' }, { status: 409 });
  }

  const { error } = await supa
    .from('brand_suggestions')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.email || null,
    })
    .eq('id', suggestion_id);

  if (error) {
    console.error('brand-suggestion update error:', error.message);
    return NextResponse.json({ error: 'Kunne ikke opdatere' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
