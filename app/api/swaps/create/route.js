import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { resolveCallerInstitution, resolveInstitutionByName } from '@/lib/institution-server';
import { SWAP_PROTECTION_FEE, calcServiceFee } from '@/lib/pricing';
import { notify } from '@/lib/notify';

// Køb-opslag bærer værdien i price; byt-opslag i estimated_value.
const itemValue = l => Number(l?.price ?? l?.estimated_value) || 0;
// Reserveret = låst i en anden igangværende handel (reserved_until i fremtiden).
const isReserved = l => !!(l?.reserved_until && new Date(l.reserved_until).getTime() > Date.now());

// Snapshot af et opslag til lagring i swap_proposals.offered_items/requested_items.
function itemSnapshot(l) {
  return {
    listing_id: l.id,
    title: l.title,
    price: itemValue(l),
    emoji: l.emoji || '🧸',
    color: l.color || null,
    image: l.images?.[0] || null,
  };
}

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }

  const offeredIds = Array.isArray(body.offeredListingIds) ? body.offeredListingIds.filter(Boolean) : [];
  const requestedIds = Array.isArray(body.requestedListingIds) ? body.requestedListingIds.filter(Boolean) : [];
  const cashAdjustment = Math.round(Number(body.cashAdjustment || 0) * 100) / 100;
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;

  // Rent kontant-tilbud (ingen tilbudte varer) = KØB: anmoderen er køber og
  // betaler altid — cash_payer tvinges til 'initiator'.
  const isPurchase = offeredIds.length === 0 && cashAdjustment > 0;
  const cashPayer = isPurchase
    ? 'initiator'
    : (body.cashPayer === 'initiator' || body.cashPayer === 'owner' ? body.cashPayer : null);

  if (!requestedIds.length) {
    return NextResponse.json({ error: 'Vælg mindst én vare du vil bytte til dig' }, { status: 400 });
  }
  if (!offeredIds.length && cashAdjustment <= 0) {
    return NextResponse.json({ error: 'Tilbyd mindst én vare eller et kontant beløb' }, { status: 400 });
  }
  if (!Number.isFinite(cashAdjustment) || cashAdjustment < 0 || cashAdjustment > 1_000_000) {
    return NextResponse.json({ error: 'Ugyldigt kontantbeløb' }, { status: 400 });
  }
  if (cashAdjustment > 0 && !cashPayer) {
    return NextResponse.json({ error: 'Angiv hvem der betaler det kontante mellemlag' }, { status: 400 });
  }

  const supa = createServerClient();
  const initiatorInst = await resolveCallerInstitution(supa, user);

  // Hent alle involverede opslag i ét kald.
  const allIds = [...new Set([...offeredIds, ...requestedIds])];
  const { data: listings } = await supa
    .from('listings')
    .select('id, title, price, estimated_value, emoji, color, images, user_id, institution_name, is_active, is_sold, reserved_until')
    .in('id', allIds);
  const byId = new Map((listings || []).map(l => [l.id, l]));

  // Valider tilbudte varer: skal tilhøre initiator og være aktive.
  const offered = [];
  for (const id of offeredIds) {
    const l = byId.get(id);
    if (!l) return NextResponse.json({ error: 'En tilbudt vare findes ikke' }, { status: 400 });
    if (l.is_sold || l.is_active === false) return NextResponse.json({ error: `"${l.title}" er ikke længere aktiv` }, { status: 409 });
    if (isReserved(l)) return NextResponse.json({ error: `"${l.title}" er reserveret i en anden handel` }, { status: 409 });
    const ownsIt = l.user_id === user.id || (initiatorInst && l.institution_name === initiatorInst.name);
    if (!ownsIt) return NextResponse.json({ error: 'Du kan kun tilbyde dine egne varer' }, { status: 403 });
    offered.push(l);
  }

  // Valider ønskede varer: skal tilhøre ÉN anden ejer-institution og være aktive.
  const requested = [];
  let ownerName = null;
  let ownerUserId = null;
  for (const id of requestedIds) {
    const l = byId.get(id);
    if (!l) return NextResponse.json({ error: 'En ønsket vare findes ikke' }, { status: 400 });
    if (l.is_sold || l.is_active === false) return NextResponse.json({ error: `"${l.title}" er ikke længere aktiv` }, { status: 409 });
    if (isReserved(l)) return NextResponse.json({ error: `"${l.title}" er reserveret i en anden handel` }, { status: 409 });
    if (l.user_id === user.id) return NextResponse.json({ error: 'Du kan ikke bytte til dine egne varer' }, { status: 400 });
    if (ownerName === null) { ownerName = l.institution_name; ownerUserId = l.user_id; }
    else if (l.institution_name !== ownerName) {
      return NextResponse.json({ error: 'Alle ønskede varer skal være fra samme institution' }, { status: 400 });
    }
    requested.push(l);
  }

  const ownerInst = await resolveInstitutionByName(supa, ownerName);
  if (initiatorInst && ownerInst && initiatorInst.id === ownerInst.id) {
    return NextResponse.json({ error: 'Du kan ikke bytte med dig selv' }, { status: 400 });
  }

  const offeredValue = offered.reduce((s, l) => s + itemValue(l), 0);
  const requestedValue = requested.reduce((s, l) => s + itemValue(l), 0);

  // Find/opret samtale med den primære ønskede vare som kontekst.
  const primary = requested[0];
  const orFind = initiatorInst?.id
    ? `initiator_institution_id.eq.${initiatorInst.id},initiator_id.eq.${user.id}`
    : `initiator_id.eq.${user.id}`;
  let convId = null;
  let ownerUnread = 0;
  const { data: existRows } = await supa
    .from('conversations')
    .select('id, owner_unread')
    .eq('listing_id', primary.id)
    .or(orFind)
    .order('created_at', { ascending: true })
    .limit(1);
  if (existRows?.[0]) {
    convId = existRows[0].id;
    ownerUnread = existRows[0].owner_unread || 0;
  } else {
    const { data: conv } = await supa.from('conversations').insert({
      listing_id: primary.id,
      listing_title: primary.title,
      listing_emoji: primary.emoji,
      listing_color: primary.color,
      listing_image: primary.images?.[0] || null,
      initiator_id: user.id,
      initiator_name: initiatorInst?.name || user.email,
      initiator_institution_id: initiatorInst?.id || null,
      owner_id: ownerUserId,
      owner_name: ownerName,
      owner_institution_id: ownerInst?.id || null,
    }).select('id').single();
    convId = conv?.id || null;
  }

  const { data: proposal, error: propErr } = await supa.from('swap_proposals').insert({
    conversation_id: convId,
    initiator_id: user.id,
    initiator_institution_id: initiatorInst?.id || null,
    owner_institution_id: ownerInst?.id || null,
    offered_items: offered.map(itemSnapshot),
    requested_items: requested.map(itemSnapshot),
    offered_value: offeredValue,
    requested_value: requestedValue,
    cash_adjustment: cashAdjustment,
    cash_payer: cashPayer,
    // Ved køb er beskyttelsen standard købsbeskyttelse (5% + 5 kr) af beløbet;
    // ved bytte den faste byttebeskyttelse pr. part.
    protection_fee: isPurchase ? calcServiceFee(cashAdjustment) : SWAP_PROTECTION_FEE,
    status: 'pending',
    escrow_status: 'none',
  }).select().single();

  if (propErr || !proposal) {
    console.error('[swaps/create] DB fejl:', propErr);
    return NextResponse.json({ error: 'Bytteforslaget kunne ikke oprettes' }, { status: 500 });
  }

  // Tråd-boble i beskeder (swap_proposals er sandhedskilden; beskeden er kun visning).
  const preview = isPurchase
    ? `💰 Købstilbud: ${cashAdjustment} kr. for ${requested.length} vare(r)`
    : `🔄 Bytteforslag: ${offered.length} vare(r)${cashAdjustment > 0 ? ` + ${cashAdjustment} kr.` : ''} for ${requested.length} vare(r)`;
  if (convId) {
    await supa.from('chat_messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      sender_name: initiatorInst?.name || user.email,
      content: JSON.stringify({ proposal_id: proposal.id }),
      message_type: 'swap_proposal',
    });
    await supa.from('conversations').update({
      last_message: preview,
      last_message_at: new Date().toISOString(),
      owner_unread: ownerUnread + 1,
      is_handled: false,
    }).eq('id', convId);
  }

  // In-app notifikation til modtageren (klokke-menuen). Best-effort — må ikke
  // vælte oprettelsen hvis den fejler.
  if (ownerInst?.id || ownerName) {
    try {
      // Klokke + e-mail + push i ét kald (C1).
      await notify(supa, {
        institutionId: ownerInst?.id || null,
        institutionName: ownerInst?.name || ownerName || null,
        type: 'swap_proposal_received',
        title: isPurchase ? 'Nyt købstilbud 💰' : 'Nyt bytteforslag 🔄',
        body: isPurchase
          ? `${initiatorInst?.name || 'En institution'} vil købe ${requested.length} vare(r) for ${cashAdjustment} kr.`
          : `${initiatorInst?.name || 'En institution'} har sendt dig et bytteforslag${cashAdjustment > 0 ? ` (+ ${cashAdjustment} kr. kontant)` : ''}.`,
        data: { proposal_id: proposal.id, conversation_id: convId },
        url: '/beskeder',
      });
    } catch (e) { console.error('[swaps/create] notifikation fejl:', e?.message); }
  }

  return NextResponse.json({
    proposal,
    conversationId: convId,
    initiatorName: initiatorInst?.name || null,
    owner: { email: ownerInst?.email || null, name: ownerInst?.name || ownerName || null },
  });
}
