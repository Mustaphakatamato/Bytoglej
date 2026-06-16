import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

// POST — toggle institution is_approved (admin only). Logs to admin_audit_log.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const adminDb = createServerClient();
  const { data: adminCheck } = await adminDb.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { institutionId, approve, note } = await req.json();
    if (!institutionId || typeof approve !== 'boolean') {
      return NextResponse.json({ error: 'Ugyldig anmodning' }, { status: 400 });
    }

    const { data: inst } = await adminDb
      .from('institutions')
      .select('id,name,is_approved')
      .eq('id', institutionId)
      .maybeSingle();
    if (!inst) return NextResponse.json({ error: 'Institution ikke fundet' }, { status: 404 });

    const update = { is_approved: approve };
    if (approve) update.approved_at = new Date().toISOString();

    const { error } = await adminDb.from('institutions').update(update).eq('id', institutionId);
    if (error) throw error;

    await adminDb.from('admin_audit_log').insert({
      admin_id: user.id,
      admin_email: user.email,
      action: approve ? 'activate_institution' : 'deactivate_institution',
      target_type: 'institution',
      target_id: institutionId,
      target_name: inst.name,
      details: { note: note || null },
    });

    return NextResponse.json({ ok: true, is_approved: approve });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
