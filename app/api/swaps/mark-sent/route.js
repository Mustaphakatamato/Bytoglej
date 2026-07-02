import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { resolveCallerInstitution } from '@/lib/institution-server';
import { notify } from '@/lib/notify';

// En part i en byttehandel markerer SIN udgående bundt som afsendt.
// Parallelt med købs-flowets seller-mark-sent: sætter initiator_sent /
// owner_sent, giver modparten besked (chat + notifikation) og trackingen.
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
    .select('id, conversation_id, escrow_status, initiator_id, initiator_institution_id, owner_institution_id, initiator_sent, owner_sent, initiator_delivery, owner_delivery, initiator_shipment_id, owner_shipment_id')
    .eq('id', proposalId)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: 'Byttehandlen findes ikke' }, { status: 404 });

  const inst = await resolveCallerInstitution(supa, user);
  const myInstId = inst?.id || null;

  let party = null;
  if (p.initiator_id === user.id || (myInstId && p.initiator_institution_id === myInstId)) party = 'initiator';
  else if (myInstId && p.owner_institution_id === myInstId) party = 'owner';
  if (!party) return NextResponse.json({ error: 'Du er ikke en del af denne byttehandel' }, { status: 403 });

  // Kun muligt når begge har betalt (forsendelser er bookede / levering aftalt).
  if (p.escrow_status !== 'both_paid_released') {
    return NextResponse.json({ error: 'Byttehandlen er ikke betalt af begge parter endnu' }, { status: 400 });
  }

  const isInit = party === 'initiator';
  const sentField = isInit ? 'initiator_sent' : 'owner_sent';
  if (p[sentField]) {
    return NextResponse.json({ ok: true, already_sent: true });
  }

  // Min udgående bundt modtages af modparten, hvis leveringsvalg afgør label:
  //   initiator sender → owner modtager → owner_delivery styrer label
  //   owner sender     → initiator modtager → initiator_delivery styrer label
  const recipientDelivery = isInit ? p.owner_delivery : p.initiator_delivery;
  const myShipmentId      = isInit ? p.initiator_shipment_id : p.owner_shipment_id;
  const recipientInstId   = isInit ? p.owner_institution_id : p.initiator_institution_id;

  let tracking = null;
  if (myShipmentId) {
    const { data: sh } = await supa.from('shipments')
      .select('tracking_number, tracking_url').eq('id', myShipmentId).maybeSingle();
    tracking = sh || null;
  }

  await supa.from('swap_proposals').update({ [sentField]: true }).eq('id', proposalId);

  const now = new Date().toISOString();
  const senderName = inst?.name || 'Modpart';
  const isCustom = recipientDelivery === 'custom';

  if (p.conversation_id) {
    const msg = isCustom
      ? `🤝 ${senderName} har markeret sin del som afsendt/overdraget.`
      : tracking?.tracking_url
        ? `🚚 ${senderName} har afsendt sin del. Følg pakken: ${tracking.tracking_url}`
        : tracking?.tracking_number
          ? `🚚 ${senderName} har afsendt sin del. Trackingnummer: ${tracking.tracking_number}`
          : `🚚 ${senderName} har afsendt sin del af byttet.`;
    // Beskeden er relevant for MODTAGEREN — bump deres unread.
    const unreadField = isInit ? 'owner_unread' : 'initiator_unread';
    await supa.from('chat_messages').insert({
      conversation_id: p.conversation_id,
      sender_id: user.id,
      sender_name: senderName,
      content: msg,
    });
    const { data: conv } = await supa.from('conversations')
      .select(`${unreadField}`).eq('id', p.conversation_id).maybeSingle();
    await supa.from('conversations').update({
      last_message: msg,
      last_message_at: now,
      [unreadField]: (conv?.[unreadField] || 0) + 1,
    }).eq('id', p.conversation_id);
  }

  try {
    await notify(supa, {
      institutionId: recipientInstId,
      type: 'swap_shipped',
      title: '🚚 Din byttepakke er på vej',
      body: `${senderName} har afsendt sin del af byttehandlen.${tracking?.tracking_number ? ` Trackingnummer: ${tracking.tracking_number}` : ''}`,
      data: { proposal_id: proposalId, conversation_id: p.conversation_id, tracking_url: tracking?.tracking_url || null },
      url: '/mine-ordrer',
    });
  } catch (e) { console.error('[swaps/mark-sent] notify fejl:', e?.message); }

  return NextResponse.json({ ok: true });
}
