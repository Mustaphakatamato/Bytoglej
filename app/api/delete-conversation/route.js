import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

// Sletter en samtale + alle dens beskeder server-side via service role.
// Dette bypasser RLS pålideligt — client-side delete fejler ellers tavst
// for institutions-samtaler hvor owner_id/initiator_id er null.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  try {
    const body = await req.json();
    const ids = Array.isArray(body.conversation_ids)
      ? body.conversation_ids
      : body.conversation_id
        ? [body.conversation_id]
        : [];
    const convIds = ids.map(id => String(id || '').slice(0, 100)).filter(Boolean);
    if (!convIds.length) return NextResponse.json({ error: 'Mangler conversation_id' }, { status: 400 });

    const svc = createServerClient();

    // Saml brugerens institutions-ID'er og -navne, så vi kan verificere deltagelse.
    const email = user.email?.toLowerCase() || '';
    const [ledRes, memberRes] = await Promise.all([
      svc.from('institutions').select('id,name').or(`email.ilike."${email}",leader_email.ilike."${email}"`),
      svc.from('institution_members').select('institution_id').ilike('email', email),
    ]);
    const memberInstIds = (memberRes.data || []).map(m => m.institution_id);
    let memberInsts = [];
    if (memberInstIds.length) {
      const { data } = await svc.from('institutions').select('id,name').in('id', memberInstIds);
      memberInsts = data || [];
    }
    const myInstIds = new Set([...(ledRes.data || []), ...memberInsts].map(i => i.id));
    const myInstNames = new Set([...(ledRes.data || []), ...memberInsts].map(i => (i.name || '').toLowerCase()));

    function isParticipant(c) {
      if (c.initiator_id === user.id || c.owner_id === user.id) return true;
      if (c.owner_institution_id && myInstIds.has(c.owner_institution_id)) return true;
      if (c.initiator_institution_id && myInstIds.has(c.initiator_institution_id)) return true;
      const on = (c.owner_name || '').toLowerCase();
      const inm = (c.initiator_name || '').toLowerCase();
      if (on && myInstNames.has(on)) return true;
      if (inm && myInstNames.has(inm)) return true;
      if (on === email || inm === email) return true;
      return false;
    }

    const { data: convs } = await svc.from('conversations').select('*').in('id', convIds);
    if (!convs?.length) return NextResponse.json({ ok: true, deleted: 0 });

    const allowed = convs.filter(isParticipant);
    if (!allowed.length) return NextResponse.json({ error: 'Ingen adgang til disse samtaler' }, { status: 403 });

    // Soft delete: sæt flag for den part der sletter — modparten beholder samtalen.
    for (const conv of allowed) {
      const isInit = conv.initiator_id === user.id
        || (conv.initiator_institution_id && myInstIds.has(conv.initiator_institution_id))
        || myInstNames.has((conv.initiator_name || '').toLowerCase());
      const field = isInit ? 'deleted_by_initiator' : 'deleted_by_owner';
      await svc.from('conversations').update({ [field]: true }).eq('id', conv.id);
    }

    return NextResponse.json({ ok: true, deleted: allowed.length });
  } catch (e) {
    console.error('delete-conversation error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
