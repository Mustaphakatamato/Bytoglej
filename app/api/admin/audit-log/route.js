import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

// GET — fetch admin audit log (admin only). Limit 200, newest first.
export async function GET(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const adminDb = createServerClient();
  const { data: adminCheck } = await adminDb.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { data, error } = await adminDb
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ log: data || [] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
