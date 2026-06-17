import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { resolveCallerInstitution, resolveInstitutionByName } from '@/lib/institution-server';
import { DAILY_OFFER_LIMIT, offersUsedToday } from '@/lib/offer-quota';

// Hvor længe et tilbud er gyldigt indtil sælger har svaret.
const OFFER_TTL_DAYS = 7;

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }

  const listingId = body.listingId;
  const amount = Math.round(Number(body.amount) * 100) / 100;
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;

  if (!listingId) return NextResponse.json({ error: 'listingId mangler' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Ugyldigt beløb' }, { status: 400 });
  }
  if (amount > 1_000_000) return NextResponse.json({ error: 'Beløbet er for højt' }, { status: 400 });

  const supa = createServerClient();

  const { data: listing } = await supa
    .from('listings')
    .select('id, title, price, emoji, color, images, user_id, institution_name, type, is_active, is_sold, min_bid, reserved_until, reserved_for_institution_id')
    .eq('id', listingId)
    .maybeSingle();

  if (!listing) return NextResponse.json({ error: 'Opslaget findes ikke' }, { status: 404 });
  if (listing.is_sold || listing.is_active === false) {
    return NextResponse.json({ error: 'Opslaget er ikke længere aktivt' }, { status: 409 });
  }
  if (listing.type === 'byt') {
    return NextResponse.json({ error: 'Du kan ikke give tilbud på et bytte-opslag' }, { status: 400 });
  }
  if (listing.user_id && listing.user_id === user.id) {
    return NextResponse.json({ error: 'Du kan ikke give tilbud på dit eget opslag' }, { status: 400 });
  }
  if (listing.min_bid && amount < listing.min_bid) {
    return NextResponse.json({ error: `Mindstebud er ${listing.min_bid} kr.` }, { status: 400 });
  }

  const buyerInst = await resolveCallerInstitution(supa, user);
  const sellerInst = await resolveInstitutionByName(supa, listing.institution_name);

  // Hård reservation (beslutning 1.5): er varen reserveret til en ANDEN
  // institution lige nu, kan man ikke byde.
  const reservedActive = listing.reserved_until && new Date(listing.reserved_until).getTime() > Date.now();
  if (reservedActive && listing.reserved_for_institution_id
      && listing.reserved_for_institution_id !== (buyerInst?.id || null)) {
    return NextResponse.json({ error: 'Varen er reserveret til en anden køber lige nu — prøv igen senere' }, { status: 409 });
  }

  // Dagligt loft (Copenhagen-kalenderdag) — samme kilde som /api/offers/quota.
  const usedToday = await offersUsedToday(supa, {
    buyerInstitutionId: buyerInst?.id || null,
    buyerId: user.id,
  });
  if (usedToday >= DAILY_OFFER_LIMIT) {
    return NextResponse.json(
      { error: `Du har nået dagens grænse på ${DAILY_OFFER_LIMIT} tilbud. Prøv igen i morgen.`, remainingToday: 0, dailyLimit: DAILY_OFFER_LIMIT },
      { status: 429 }
    );
  }

  // Find eller opret samtale, så tilbuddet trådes ind i beskeder.
  const orFind = buyerInst?.id
    ? `initiator_institution_id.eq.${buyerInst.id},initiator_id.eq.${user.id}`
    : `initiator_id.eq.${user.id}`;
  let convId = null;
  let ownerUnread = 0;
  const { data: existRows } = await supa
    .from('conversations')
    .select('id, owner_unread')
    .eq('listing_id', listing.id)
    .or(orFind)
    .order('created_at', { ascending: true })
    .limit(1);
  if (existRows?.[0]) {
    convId = existRows[0].id;
    ownerUnread = existRows[0].owner_unread || 0;
  } else {
    const { data: conv } = await supa.from('conversations').insert({
      listing_id: listing.id,
      listing_title: listing.title,
      listing_emoji: listing.emoji,
      listing_color: listing.color,
      listing_image: listing.images?.[0] || null,
      initiator_id: user.id,
      initiator_name: buyerInst?.name || user.email,
      initiator_institution_id: buyerInst?.id || null,
      owner_id: listing.user_id,
      owner_name: listing.institution_name,
      owner_institution_id: sellerInst?.id || null,
    }).select('id').single();
    convId = conv?.id || null;
  }

  // Erstat eventuelt tidligere åbent tilbud fra samme køber på dette opslag.
  {
    const supersedeCol = buyerInst?.id ? 'buyer_institution_id' : 'buyer_id';
    const supersedeVal = buyerInst?.id || user.id;
    await supa.from('offers')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('listing_id', listing.id)
      .eq('status', 'pending')
      .eq(supersedeCol, supersedeVal);
  }

  const { data: offer, error: offerErr } = await supa.from('offers').insert({
    listing_id: listing.id,
    conversation_id: convId,
    buyer_id: user.id,
    buyer_institution_id: buyerInst?.id || null,
    seller_institution_id: sellerInst?.id || null,
    amount,
    status: 'pending',
    proposed_by: 'buyer',
    note,
    expires_at: new Date(Date.now() + OFFER_TTL_DAYS * 24 * 3600 * 1000).toISOString(),
  }).select().single();

  if (offerErr || !offer) {
    console.error('[offers/create] DB fejl:', offerErr);
    return NextResponse.json({ error: 'Tilbuddet kunne ikke oprettes' }, { status: 500 });
  }

  // Tråd-boble i beskeder (offers-tabellen er sandhedskilden; beskeden er kun visning).
  const preview = `Tilbud: ${amount} kr.`;
  if (convId) {
    await supa.from('chat_messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      sender_name: buyerInst?.name || user.email,
      content: JSON.stringify({ offer_id: offer.id, amount, listing_title: listing.title }),
      message_type: 'offer',
    });
    await supa.from('conversations').update({
      last_message: preview,
      last_message_at: new Date().toISOString(),
      owner_unread: ownerUnread + 1,
      is_handled: false,
    }).eq('id', convId);
  }

  return NextResponse.json({
    offer,
    conversationId: convId,
    remainingToday: Math.max(0, DAILY_OFFER_LIMIT - usedToday - 1),
    dailyLimit: DAILY_OFFER_LIMIT,
  });
}
