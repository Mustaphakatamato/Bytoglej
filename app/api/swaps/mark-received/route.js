import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { resolveCallerInstitution } from '@/lib/institution-server';

// Den part der har MODTAGET modpartens bundt bekræfter modtagelse.
// Sætter initiator_received / owner_received alt efter hvem kalderen er.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }
  const proposalId = body.proposalId;
  if (!proposalId) return NextResponse.json({ error: 'Mangler forslag' }, { status: 400 });

  const supa = createServerClient();
  const { data: p } = await supa
    .from('swap_proposals')
    .select('id, initiator_institution_id, owner_institution_id, initiator_id')
    .eq('id', proposalId)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: 'Byttehandlen findes ikke' }, { status: 404 });

  const inst = await resolveCallerInstitution(supa, user);
  const myInstId = inst?.id || null;

  let party = null;
  if (p.initiator_id === user.id || (myInstId && p.initiator_institution_id === myInstId)) party = 'initiator';
  else if (myInstId && p.owner_institution_id === myInstId) party = 'owner';
  if (!party) return NextResponse.json({ error: 'Du er ikke en del af denne byttehandel' }, { status: 403 });

  const field = party === 'owner' ? 'owner_received' : 'initiator_received';
  const { error } = await supa.from('swap_proposals').update({ [field]: true }).eq('id', proposalId);
  if (error) {
    console.error('[swaps/mark-received] DB fejl:', error);
    return NextResponse.json({ error: 'Kunne ikke gemme' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
