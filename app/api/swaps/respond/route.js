import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { userBelongsToInstitution } from '@/lib/institution-server';

// Begge parter skal betale inden for dette vindue efter accept (beslutning 2.6).
const PAYMENT_DEADLINE_HOURS = 48;

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }

  const { proposalId, action } = body;
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;
  if (!proposalId || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Ugyldig handling' }, { status: 400 });
  }

  const supa = createServerClient();

  const { data: proposal } = await supa.from('swap_proposals').select('*').eq('id', proposalId).maybeSingle();
  if (!proposal) return NextResponse.json({ error: 'Bytteforslaget findes ikke' }, { status: 404 });
  if (proposal.status !== 'pending') {
    return NextResponse.json({ error: 'Bytteforslaget er ikke længere åbent' }, { status: 409 });
  }

  const convId = proposal.conversation_id;
  const { data: conv } = convId
    ? await supa.from('conversations').select('*').eq('id', convId).maybeSingle()
    : { data: null };

  // Kun ejer-parten (modtageren af forslaget) må svare — ikke initiator.
  const isOwner = (conv && conv.owner_id === user.id)
    || await userBelongsToInstitution(supa, user, proposal.owner_institution_id);
  if (!isOwner) {
    return NextResponse.json({ error: 'Kun modtageren kan svare på bytteforslaget' }, { status: 403 });
  }

  const now = new Date().toISOString();

  async function insertMessage(content) {
    if (!convId) return;
    await supa.from('chat_messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      sender_name: conv?.owner_name || user.email,
      content,
    });
  }
  async function bumpInitiator(lastMessage, extra = {}) {
    if (!convId) return;
    await supa.from('conversations').update({
      last_message: lastMessage,
      last_message_at: now,
      initiator_unread: (conv?.initiator_unread || 0) + 1,
      ...extra,
    }).eq('id', convId);
  }

  // Notifikations-modtager = initiator.
  let notify = null;
  if (proposal.initiator_institution_id) {
    const { data: ii } = await supa.from('institutions').select('email, name').eq('id', proposal.initiator_institution_id).maybeSingle();
    if (ii?.email) notify = { email: ii.email, name: ii.name };
  }

  if (action === 'reject') {
    await supa.from('swap_proposals').update({ status: 'rejected', escrow_status: 'none' }).eq('id', proposal.id);
    await insertMessage(`❌ Bytteforslaget blev afvist${note ? ' – ' + note : ''}`);
    await bumpInitiator('Bytteforslag afvist', { is_handled: true, handled_at: now, handled_action: 'rejected' });
    return NextResponse.json({ ok: true, status: 'rejected', notify });
  }

  // ---- ACCEPT ----
  const deadline = new Date(Date.now() + PAYMENT_DEADLINE_HOURS * 3600 * 1000).toISOString();
  await supa.from('swap_proposals').update({
    status: 'accepted',
    escrow_status: 'awaiting_both',
    accepted_at: now,
    payment_deadline: deadline,
  }).eq('id', proposal.id);

  // Reservér alle involverede varer indtil betalingsfristen, så de ikke
  // sælges/byttes andetsteds mens escrow løber.
  const involvedIds = [
    ...(proposal.offered_items || []),
    ...(proposal.requested_items || []),
  ].map(i => i.listing_id).filter(Boolean);
  if (involvedIds.length) {
    await supa.from('listings').update({ reserved_until: deadline }).in('id', involvedIds);
  }

  await insertMessage('🔄 Bytteforslag godkendt — begge parter betaler forsendelse + beskyttelse inden 48 timer.');
  await bumpInitiator('🔄 Bytteforslag godkendt — betal inden 48 timer', {
    is_handled: true, handled_at: now, handled_action: 'accepted',
  });

  return NextResponse.json({ ok: true, status: 'accepted', paymentDeadline: deadline, notify });
}
