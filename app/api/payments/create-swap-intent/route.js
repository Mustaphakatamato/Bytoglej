import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { getShippingPrice } from '@/lib/shipping-rates';
import { getPriceQuote } from '@/lib/shipmondo/client';

// Fast byttebeskyttelse pr. part (jf. produktbeslutning).
const SWAP_PROTECTION_FEE = 10;

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY er ikke sat');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }

  const conversationId = body.conversationId;
  const deliveryMethod = body.deliveryMethod === 'custom' ? 'custom' : 'shipping';
  if (!conversationId) return NextResponse.json({ error: 'Mangler samtale' }, { status: 400 });

  const supa = createServerClient();

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
    .or(`email.eq.${user.email},leader_email.eq.${user.email}`)
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
      try {
        const quote = await getPriceQuote({
          carrier: 'gls', service_type: 'parcel_shop', size_category: sizeCategory,
          sender:   { name: myInst.name, address: myInst.address, zip: myInst.zipcode, city: myInst.city, email: myInst.email },
          receiver: { name: receiverInst.name, address: receiverInst.address, zip: receiverInst.zipcode, city: receiverInst.city, email: receiverInst.email },
        });
        if (quote?.price_dkk > 0) porto = Math.round(quote.price_dkk * 100) / 100;
      } catch (e) {
        console.error('[create-swap-intent] Shipmondo quote fejlede — bruger tabel:', e.message);
      }
    }
  }

  const grandTotal = Math.round((porto + SWAP_PROTECTION_FEE) * 100) / 100;
  const amountOre = Math.round(grandTotal * 100);
  if (!Number.isInteger(amountOre) || amountOre < 250) {
    return NextResponse.json({ error: 'Beløbet er for lavt til online betaling' }, { status: 400 });
  }

  const stripe = getStripe();
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountOre,
      currency: 'dkk',
      payment_method_types: ['card', 'mobilepay'],
      metadata: {
        type: 'swap',
        conversation_id: conversationId,
        party,
        delivery_method: deliveryMethod,
        size_category: String(sizeCategory),
        buyer_id: user.id,
      },
      description: `Bytogleg byttehandel: ${conv.listing_title || ''}`,
    });
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
