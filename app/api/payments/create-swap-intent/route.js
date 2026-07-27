import { NextResponse } from 'next/server';
import { getStripe, createPaymentIntent } from '@/lib/stripe';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { getShippingPrice } from '@/lib/shipping-rates';
import { getPriceQuote } from '@/lib/shipmondo/client';
import { SWAP_PROTECTION_FEE, isCashPurchaseProposal } from '@/lib/pricing';
import { resolveCallerInstitution } from '@/lib/institution-server';

const SIZE_RANK = { small: 1, medium: 2, large: 3 };

// Største størrelse blandt en bundts varer (én forsendelse pr. retning).
async function largestSize(supa, listingIds) {
  if (!listingIds.length) return 'medium';
  const { data } = await supa.from('shipping_options').select('shipping_size_category').in('listing_id', listingIds);
  let best = 'medium', rank = 0;
  for (const s of (data || [])) {
    const r = SIZE_RANK[s.shipping_size_category] || 2;
    if (r > rank) { rank = r; best = s.shipping_size_category; }
  }
  return best;
}

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }

  const conversationId = body.conversationId;
  const deliveryMethod = body.deliveryMethod === 'custom' ? 'custom' : 'shipping';

  const supa = createServerClient();

  // Nyt swap_proposals-baseret bundt-bytte (additivt ved siden af det
  // gamle conversations.swap_*-flow). Udleder selv samtalen fra forslaget,
  // så det kræver ikke conversationId i requesten.
  if (body.proposalId) {
    return handleProposalIntent(user, supa, body);
  }

  // Gammelt flow (conversations.swap_*) kræver en samtale.
  if (!conversationId) return NextResponse.json({ error: 'Mangler samtale' }, { status: 400 });

  const { data: conv } = await supa
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: 'Samtale ikke fundet' }, { status: 404 });
  if (!conv.swap_accepted) return NextResponse.json({ error: 'Byttehandlen er ikke godkendt endnu' }, { status: 409 });

  // Find ud af om brugeren er initiator eller ejer i samtalen
  let { data: myInst } = await supa
    .from('institutions')
    .select('id, name, address, zipcode, city, email, phone')
    .or(`email.eq."${user.email}",leader_email.eq."${user.email}"`)
    .maybeSingle();
  if (!myInst) {
    // Teammedlem: slå institution op via medlemskab
    const { data: mem } = await supa
      .from('institution_members')
      .select('institution_id')
      .ilike('email', user.email)
      .maybeSingle();
    if (mem?.institution_id) {
      const { data } = await supa
        .from('institutions')
        .select('id, name, address, zipcode, city, email, phone')
        .eq('id', mem.institution_id)
        .maybeSingle();
      myInst = data;
    }
  }
  const myInstId = myInst?.id || null;

  let party = null;
  if (conv.initiator_id === user.id || (myInstId && conv.initiator_institution_id === myInstId)) party = 'initiator';
  else if (conv.owner_id === user.id || (myInstId && conv.owner_institution_id === myInstId)) party = 'owner';
  if (!party) return NextResponse.json({ error: 'Du er ikke en del af denne byttehandel' }, { status: 403 });

  if (party === 'initiator' && conv.swap_initiator_paid) return NextResponse.json({ error: 'Du har allerede betalt' }, { status: 409 });
  if (party === 'owner' && conv.swap_owner_paid) return NextResponse.json({ error: 'Du har allerede betalt' }, { status: 409 });

  // Hvad sender denne part, og til hvem?
  const myListingId    = party === 'initiator' ? conv.swap_initiator_listing_id : conv.swap_owner_listing_id;
  const otherInstId    = party === 'initiator' ? conv.owner_institution_id      : conv.initiator_institution_id;

  // Porto: kun ved forsendelse. Beregnes for afsenderens vare → modtagerens adresse.
  let porto = 0;
  let sizeCategory = 'medium';
  if (deliveryMethod === 'shipping') {
    if (myListingId) {
      const { data: so } = await supa
        .from('shipping_options')
        .select('shipping_size_category')
        .eq('listing_id', myListingId)
        .maybeSingle();
      sizeCategory = so?.shipping_size_category || 'medium';
    }
    // Estimat fra tabel (billigste pakkeshop) — autoritativ ved booking.
    porto = getShippingPrice('parcel_shop_gls', sizeCategory) || 0;

    // Forsøg en live Shipmondo-pris hvis vi har begge adresser.
    let receiverInst = null;
    if (otherInstId) {
      const { data } = await supa.from('institutions').select('name, address, zipcode, city, email').eq('id', otherInstId).maybeSingle();
      receiverInst = data;
    }
    if (myInst && receiverInst) {
      let quoted = null;
      try {
        const quote = await getPriceQuote({
          carrier: 'gls', service_type: 'parcel_shop', size_category: sizeCategory,
          sender:   { name: myInst.name, address: myInst.address, zip: myInst.zipcode, city: myInst.city, email: myInst.email },
          receiver: { name: receiverInst.name, address: receiverInst.address, zip: receiverInst.zipcode, city: receiverInst.city, email: receiverInst.email },
        });
        if (quote?.price_dkk > 0) quoted = Math.round(quote.price_dkk * 100) / 100;
      } catch (e) {
        console.error('[create-swap-intent] Shipmondo quote fejlede:', e.message);
      }
      // Fail closed: blokér frem for at opkræve den for-lave tabelpris.
      if (quoted === null) {
        return NextResponse.json({ error: 'Kunne ikke beregne fragtpris lige nu. Prøv igen om lidt.' }, { status: 503 });
      }
      porto = quoted;
    }
  }

  const grandTotal = Math.round((porto + SWAP_PROTECTION_FEE) * 100) / 100;
  const amountOre = Math.round(grandTotal * 100);
  if (!Number.isInteger(amountOre) || amountOre < 250) {
    return NextResponse.json({ error: 'Beløbet er for lavt til online betaling' }, { status: 400 });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    console.error('[create-swap-intent] Stripe-konfiguration:', e.message);
    return NextResponse.json({ error: 'Betaling er ikke tilgængelig lige nu. Kontakt support.' }, { status: 503 });
  }
  let paymentIntent;
  try {
    paymentIntent = await createPaymentIntent(stripe, {
      amount: amountOre,
      currency: 'dkk',
      metadata: {
        type: 'swap',
        conversation_id: conversationId,
        party,
        delivery_method: deliveryMethod,
        size_category: String(sizeCategory),
        buyer_id: user.id,
      },
      description: `Bytogleg byttehandel: ${conv.listing_title || ''}`,
    }, '[create-swap-intent]');
  } catch (err) {
    console.error('[create-swap-intent] Stripe fejl:', err.message);
    return NextResponse.json({ error: 'Betalingen kunne ikke oprettes. Prøv igen' }, { status: 502 });
  }

  const breakdown = [{
    sellerName: deliveryMethod === 'shipping' ? 'Byttehandel: forsendelse af din vare' : 'Byttehandel: aftalt levering',
    items: [],
    shippingTotal: porto,
    serviceFee: SWAP_PROTECTION_FEE,
    groupTotal: grandTotal,
  }];

  const { data: order, error } = await supa
    .from('orders')
    .insert({
      payment_intent_id: paymentIntent.id,
      buyer_id: user.id,
      buyer_institution_id: myInstId,
      buyer_name: myInst?.name || null,
      buyer_email: myInst?.email || user.email || null,
      grand_total: grandTotal,
      status: 'pending',
      order_groups: breakdown,
    })
    .select()
    .single();

  if (error) {
    console.error('[create-swap-intent] DB fejl:', error);
    try { await stripe.paymentIntents.cancel(paymentIntent.id); } catch {}
    return NextResponse.json({ error: 'Kunne ikke oprette ordre' }, { status: 500 });
  }

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    orderId: order.id,
    grandTotal,
    breakdown,
  });
}

// ── Bundt-bytte via swap_proposals ────────────────────────────────
// Beregner én parts andel: porto for egen udgående bundt + fast
// beskyttelse + kontant mellemlag hvis denne part er betaleren.
async function handleProposalIntent(user, supa, body) {
  const deliveryMethod = body.deliveryMethod === 'custom' ? 'custom' : 'shipping';
  // Valgt udleveringssted (GLS/PostNord/DAO pakkeshop) — påkrævet for pakkeshop-booking.
  const pickupPointId = body.pickupPointId || null;
  const pickupPoint = (body.pickupPoint && typeof body.pickupPoint === 'object') ? body.pickupPoint : null;

  const { data: proposal } = await supa.from('swap_proposals').select('*').eq('id', body.proposalId).maybeSingle();
  if (!proposal) return NextResponse.json({ error: 'Bytteforslaget findes ikke' }, { status: 404 });
  if (proposal.status !== 'accepted' || !['awaiting_both', 'awaiting_initiator', 'awaiting_owner'].includes(proposal.escrow_status)) {
    return NextResponse.json({ error: 'Byttehandlen er ikke klar til betaling' }, { status: 409 });
  }
  if (proposal.payment_deadline && new Date(proposal.payment_deadline).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Betalingsfristen er overskredet — byttet er annulleret' }, { status: 409 });
  }

  const inst = await resolveCallerInstitution(supa, user);
  const myInstId = inst?.id || null;

  let party = null;
  if (proposal.initiator_id === user.id || (myInstId && proposal.initiator_institution_id === myInstId)) party = 'initiator';
  else if (myInstId && proposal.owner_institution_id === myInstId) party = 'owner';
  if (!party && proposal.conversation_id) {
    const { data: c } = await supa.from('conversations').select('owner_id, initiator_id').eq('id', proposal.conversation_id).maybeSingle();
    if (c?.owner_id === user.id) party = 'owner';
    else if (c?.initiator_id === user.id) party = 'initiator';
  }
  if (!party) return NextResponse.json({ error: 'Du er ikke en del af denne byttehandel' }, { status: 403 });

  if (party === 'initiator' && proposal.initiator_paid) return NextResponse.json({ error: 'Du har allerede betalt' }, { status: 409 });
  if (party === 'owner' && proposal.owner_paid) return NextResponse.json({ error: 'Du har allerede betalt' }, { status: 409 });

  // Rent kontant-tilbud = køb: kun køberen (initiator) betaler. Sælgeren modtager
  // betalingen på sin byt&leg-konto ved levering og skal ikke betale noget.
  const isPurchase = isCashPurchaseProposal(proposal);
  if (isPurchase && party === 'owner') {
    return NextResponse.json({ error: 'Som sælger betaler du ikke — du modtager betalingen på din byt&leg-konto ved levering.' }, { status: 403 });
  }

  // Hver part betaler porto for den pakke de MODTAGER (modpartens udgående bundt).
  const incoming = party === 'initiator' ? (proposal.requested_items || []) : (proposal.offered_items || []);
  const senderInstId = party === 'initiator' ? proposal.owner_institution_id : proposal.initiator_institution_id;

  let myInst = null;
  if (myInstId) {
    const { data } = await supa.from('institutions').select('id, name, address, zipcode, city, email, phone').eq('id', myInstId).maybeSingle();
    myInst = data;
  }

  let porto = 0;
  let sizeCategory = 'medium';
  if (deliveryMethod === 'shipping') {
    sizeCategory = await largestSize(supa, incoming.map(i => i.listing_id).filter(Boolean));
    porto = getShippingPrice('parcel_shop_gls', sizeCategory) || 0;
    let senderInst = null;
    if (senderInstId) {
      const { data } = await supa.from('institutions').select('name, address, zipcode, city, email').eq('id', senderInstId).maybeSingle();
      senderInst = data;
    }
    if (myInst && senderInst) {
      let quoted = null;
      try {
        // Pakken sendes FRA modparten TIL mig og afhentes på MIT valgte udleveringssted.
        const quote = await getPriceQuote({
          carrier: pickupPoint?.carrier_code || 'gls', service_type: 'parcel_shop', size_category: sizeCategory,
          sender:   { name: senderInst.name, address: senderInst.address, zip: senderInst.zipcode, city: senderInst.city, email: senderInst.email },
          receiver: { name: myInst.name, address: myInst.address, zip: myInst.zipcode, city: myInst.city, email: myInst.email },
          service_point_id: pickupPointId,
        });
        if (quote?.price_dkk > 0) quoted = Math.round(quote.price_dkk * 100) / 100;
      } catch (e) {
        console.error('[create-swap-intent] proposal quote fejl:', e.message);
      }
      // Fail closed: blokér frem for at opkræve den for-lave tabelpris.
      if (quoted === null) {
        return NextResponse.json({ error: 'Kunne ikke beregne fragtpris lige nu. Prøv igen om lidt.' }, { status: 503 });
      }
      porto = quoted;
    }
  }

  const protection = Number(proposal.protection_fee) || SWAP_PROTECTION_FEE;
  const cash = proposal.cash_payer === party ? (Number(proposal.cash_adjustment) || 0) : 0;
  const grandTotal = Math.round((porto + protection + cash) * 100) / 100;
  const amountOre = Math.round(grandTotal * 100);
  if (!Number.isInteger(amountOre) || amountOre < 250) {
    return NextResponse.json({ error: 'Beløbet er for lavt til online betaling' }, { status: 400 });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    console.error('[create-swap-intent] Stripe-konfiguration:', e.message);
    return NextResponse.json({ error: 'Betaling er ikke tilgængelig lige nu. Kontakt support.' }, { status: 503 });
  }
  let paymentIntent;
  try {
    paymentIntent = await createPaymentIntent(stripe, {
      amount: amountOre,
      currency: 'dkk',
      metadata: {
        type: 'swap',
        swap_proposal_id: proposal.id,
        conversation_id: proposal.conversation_id || '',
        party,
        delivery_method: deliveryMethod,
        pickup_point_id: pickupPointId ? String(pickupPointId) : '',
        size_category: String(sizeCategory),
        cash_ore: String(Math.round(cash * 100)),
        buyer_id: user.id,
      },
      description: 'Bytogleg byttehandel',
    }, '[create-swap-intent]');
  } catch (err) {
    console.error('[create-swap-intent] proposal Stripe fejl:', err.message);
    return NextResponse.json({ error: 'Betalingen kunne ikke oprettes — prøv igen' }, { status: 502 });
  }

  const breakdown = [{
    sellerName: isPurchase
      ? (deliveryMethod === 'shipping' ? 'Køb — levering af varer til dig' : 'Køb — aftalt levering')
      : (deliveryMethod === 'shipping' ? 'Byttehandel — levering af varer til dig' : 'Byttehandel — aftalt levering'),
    items: incoming.map(i => ({ title: i.title, price: 0, emoji: i.emoji })),
    shippingTotal: porto,
    serviceFee: protection,
    // Ved køb er "cash" varebetalingen; ved bytte et kontant mellemlag.
    ...(cash > 0 ? { cashAdjustment: cash, cashIsItemPayment: isPurchase } : {}),
    groupTotal: grandTotal,
  }];

  const { data: order, error } = await supa.from('orders').insert({
    payment_intent_id: paymentIntent.id,
    buyer_id: user.id,
    buyer_institution_id: myInstId,
    buyer_name: myInst?.name || null,
    buyer_email: myInst?.email || user.email || null,
    grand_total: grandTotal,
    status: 'pending',
    order_groups: breakdown,
  }).select().single();

  if (error) {
    console.error('[create-swap-intent] proposal DB fejl:', error);
    try { await stripe.paymentIntents.cancel(paymentIntent.id); } catch {}
    return NextResponse.json({ error: 'Kunne ikke oprette ordre' }, { status: 500 });
  }

  // Gem partens leveringsvalg + udleveringssted på forslaget, så webhooken
  // kan booke forsendelsen med det rigtige service point ved completion.
  const deliveryField = party === 'owner' ? 'owner_delivery' : 'initiator_delivery';
  const pickupField   = party === 'owner' ? 'owner_pickup'   : 'initiator_pickup';
  await supa.from('swap_proposals').update({
    [deliveryField]: deliveryMethod,
    [pickupField]: pickupPoint,
  }).eq('id', proposal.id);

  return NextResponse.json({ clientSecret: paymentIntent.client_secret, orderId: order.id, grandTotal, breakdown });
}
