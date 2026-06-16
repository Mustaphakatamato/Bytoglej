import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

// GET — list all auth.users (admin only). Joins with institutions by email.
export async function GET(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const adminDb = createServerClient();
  const { data: adminCheck } = await adminDb.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    // Page through auth users (service_role only).
    const users = [];
    let page = 1;
    const perPage = 1000;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await adminDb.auth.admin.listUsers({ page, perPage });
      if (error) break;
      const batch = data?.users || [];
      users.push(...batch);
      if (batch.length < perPage) break;
      page += 1;
      if (page > 20) break; // safety cap
    }

    // Build email -> institution_name maps
    const [{ data: institutions }, { data: members }] = await Promise.all([
      adminDb.from('institutions').select('id,name,email'),
      adminDb.from('institution_members').select('email,institution_id'),
    ]);

    const instById = {};
    const instByEmail = {};
    (institutions || []).forEach(i => {
      instById[i.id] = i.name;
      if (i.email) instByEmail[i.email.toLowerCase()] = i.name;
    });
    const memberByEmail = {};
    (members || []).forEach(m => { if (m.email) memberByEmail[m.email.toLowerCase()] = instById[m.institution_id]; });

    const result = users.map(u => {
      const key = (u.email || '').toLowerCase();
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        institution_name: instByEmail[key] || memberByEmail[key] || null,
      };
    });

    return NextResponse.json({ users: result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
