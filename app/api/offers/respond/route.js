import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { userBelongsToInstitution, resolveInstitutionByName } from '@/lib/institution-server';

// Hård reservation efter accept: varen holdes til køber i dette vindue.
const RESERVATION_HOURS = 24;

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }

  const { offerId, action } = body;
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;
  if (!offerId || !['accept', 'reject', 'counter'].includes(action)) {
    return NextResponse.json({ error: 'Ugyldig handling' }, { status: 400 });
  }

  const supa = createServerClient();

  const { data: offer } = await supa.from('offers').select('*').eq('id', offerId).maybeSingle();
  if (!offer) return NextResponse.json({ error: 'Tilbuddet findes ikke' }, { status: 404 });
  if (offer.status !== 'pending') {
    return NextResponse.json({ error: 'Tilbuddet er ikke længere åbent' }, { status: 409 });
  }

  const { data: listing } = await supa
    .from('listings')
    .select('id, title, user_id, institution_name, is_active, is_sold, shipping_options')
    .eq('id', offer.listing_id)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: 'Opslaget findes ikke længere' }, { status: 404 });

  // Hvem er den aktuelle bruger i forhold til tilbuddet?
  const isSeller = listing.user_id === user.id
    || await userBelongsToInstitution(supa, user, offer.seller_institution_id);
  const isBuyer = offer.buyer_id === user.id
    || await userBelongsToInstitution(supa, user, offer.buyer_institution_id);
  if (!isSeller && !isBuyer) {
    return NextResponse.json({ error: 'Du har ikke adgang til dette tilbud' }, { status: 403 });
  }

  // Man må kun svare på et tilbud man IKKE selv har fremsat.
  const responderRole = isSeller ? 'seller' : 'buyer';
  if (offer.proposed_by === responderRole) {
    return NextResponse.json({ error: 'Du kan ikke svare på dit eget tilbud' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const convId = offer.conversation_id;
  // Den part der skal notificeres (modparten af den der svarer).
  const bumpField = responderRole === 'seller' ? 'initiator_unread' : 'owner_unread';
  const senderName = (await senderNameFor(supa, user, responderRole, listing)) || user.email;

  // Modtager af notifikationen = modparten af den der svarer.
  let notify = null;
  if (responderRole === 'seller' && offer.buyer_institution_id) {
    const { data: bi } = await supa.from('institutions').select('email, name').eq('id', offer.buyer_institution_id).maybeSingle();
    if (bi?.email) notify = { email: bi.email, name: bi.name };
  } else if (responderRole === 'buyer') {
    const si = await resolveInstitutionByName(supa, listing.institution_name);
    if (si?.email) notify = { email: si.email, name: si.name };
  }

  async function bumpConversation(lastMessage, extra = {}) {
    if (!convId) return;
    const { data: c } = await supa.from('conversations')
      .select('initiator_unread, owner_unread').eq('id', convId).maybeSingle();
    await supa.from('conversations').update({
      last_message: lastMessage,
      last_message_at: now,
      [bumpField]: ((c?.[bumpField]) || 0) + 1,
      ...extra,
    }).eq('id', convId);
  }

  async function insertMessage(content, messageType = null) {
    if (!convId) return;
    await supa.from('chat_messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      sender_name: senderName,
      content,
      ...(messageType ? { message_type: messageType } : {}),
    });
  }

  // ---- ACCEPT ----
  if (action === 'accept') {
    if (listing.is_sold || listing.is_active === false) {
      return NextResponse.json({ error: 'Opslaget er ikke længere aktivt' }, { status: 409 });
    }

    await supa.from('offers').update({ status: 'accepted', responded_at: now }).eq('id', offer.id);

    // Hård reservation af varen til køber (beslutning 1.5).
    const reservedUntil = new Date(Date.now() + RESERVATION_HOURS * 3600 * 1000).toISOString();
    await supa.from('listings').update({
      reserved_until: reservedUntil,
      reserved_for_institution_id: offer.buyer_institution_id || null,
    }).eq('id', listing.id);

    // Checkout-besked så køber kan vælge levering og betale.
    const shippingOptions = listing.shipping_options?.[0] || null;
    await insertMessage(JSON.stringify({
      offer_id: offer.id,
      listing_id: listing.id,
      listing_title: listing.title,
      deal_type: 'offer',
      amount: offer.amount,
      reserved_until: reservedUntil,
      shipping_options: shippingOptions,
    }), 'checkout_pending');

    await bumpConversation(
      `✅ Tilbud på ${offer.amount} kr. accepteret — varen er reserveret i ${RESERVATION_HOURS} timer. Vælg levering for at betale.`,
      { is_handled: true, handled_at: now, handled_action: 'accepted' }
    );

    return NextResponse.json({ ok: true, status: 'accepted', reservedUntil, notify });
  }

  // ---- REJECT ----
  if (action === 'reject') {
    await supa.from('offers').update({ status: 'rejected', responded_at: now, note }).eq('id', offer.id);
    await insertMessage(`❌ Tilbud på ${offer.amount} kr. afvist${note ? ' – ' + note : ''}`);
    await bumpConversation(
      `Tilbud på ${offer.amount} kr. afvist`,
      { is_handled: true, handled_at: now, handled_action: 'rejected' }
    );
    return NextResponse.json({ ok: true, status: 'rejected', notify });
  }

  // ---- COUNTER (modbud) ----
  const counterAmount = Math.round(Number(body.counterAmount) * 100) / 100;
  if (!Number.isFinite(counterAmount) || counterAmount <= 0 || counterAmount > 1_000_000) {
    return NextResponse.json({ error: 'Ugyldigt modbud' }, { status: 400 });
  }

  await supa.from('offers').update({ status: 'countered', responded_at: now }).eq('id', offer.id);

  const { data: counter, error: counterErr } = await supa.from('offers').insert({
    listing_id: offer.listing_id,
    conversation_id: convId,
    buyer_id: offer.buyer_id,
    buyer_institution_id: offer.buyer_institution_id,
    seller_institution_id: offer.seller_institution_id,
    amount: counterAmount,
    status: 'pending',
    proposed_by: responderRole, // modbud fremsat af den der svarer
    note,
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  }).select().single();

  if (counterErr || !counter) {
    console.error('[offers/respond] modbud DB fejl:', counterErr);
    return NextResponse.json({ error: 'Modbuddet kunne ikke oprettes' }, { status: 500 });
  }

  await insertMessage(JSON.stringify({
    offer_id: counter.id, amount: counterAmount, listing_title: listing.title, counter: true,
  }), 'offer');
  await bumpConversation(`🔄 Modbud: ${counterAmount} kr.`,
    { is_handled: false });

  return NextResponse.json({ ok: true, status: 'countered', offer: counter, notify });
}

// Bedste visningsnavn for afsenderen (institution hvis muligt).
async function senderNameFor(supa, user, role, listing) {
  if (role === 'seller') return listing.institution_name || null;
  const email = (user.email || '').toLowerCase();
  const { data: inst } = await supa
    .from('institutions').select('name').ilike('email', email).maybeSingle();
  return inst?.name || null;
}
