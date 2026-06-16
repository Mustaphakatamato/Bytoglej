import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();

  try {
    const { action, log_id } = await req.json();
    if (!log_id || !['dispute', 'delete_image'].includes(action)) {
      return NextResponse.json({ error: 'Ugyldige parametre' }, { status: 400 });
    }

    if (action === 'dispute') {
      const { error } = await supa
        .from('scan_rejection_logs')
        .update({ user_disputed: true })
        .eq('id', log_id)
        .eq('user_id', user.id);
      if (error) return NextResponse.json({ error: 'Fejl ved opdatering' }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete_image') {
      const { data: adminRow } = await supa.from('admins').select('id').eq('user_id', user.id).maybeSingle();
      if (!adminRow) return NextResponse.json({ error: 'Ikke admin' }, { status: 403 });

      const { data: log } = await supa
        .from('scan_rejection_logs')
        .select('image_path')
        .eq('id', log_id)
        .maybeSingle();

      if (log?.image_path) {
        await supa.storage.from('listing-images').remove([log.image_path]);
      }

      await supa
        .from('scan_rejection_logs')
        .update({ image_path: null, deleted_at: new Date().toISOString() })
        .eq('id', log_id);

      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    console.error('admin/scan-rejection error:', e.message);
    return NextResponse.json({ error: 'Fejl' }, { status: 500 });
  }
}
