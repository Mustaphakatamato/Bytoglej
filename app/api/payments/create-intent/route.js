import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { getShippingPrice } from '@/lib/shipping-rates';
import { getPriceQuote } from '@/lib/shipmondo/client';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY er ikke sat');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Service fee: 5% of item total + 5 kr flat (Vinted-model)
function calcServiceFee(itemTotal) {
  return Math.round((itemTotal * 0.05 + 5) * 100) / 100;
}

// Bundle discount: find highest applicable tier by item count
function calcBundleDiscount(itemTotal, itemCount, seller) {
  if (!seller?.bundle_discount_enabled) return 0;
  const tiers = seller.bundle_discount_tiers;
  if (!Array.isArray(tiers) || !tiers.length) return 0;
  const sorted = [...tiers].sort((a, b) => b.min_items - a.min_items);
  const tier = sorted.find(t => itemCount >= t.min_items);
  if (!tier) return 0;
  return Math.round(itemTotal * (tier.percent / 100) * 100) / 100;
}

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 });
  }
  const { groups } = body;
  // groups: [{ sellerName, sellerId, items, shippingMethod, shippingPrice, pickupPoint, note }]

  if (!Array.isArray(groups) || !groups.length) {
    return NextResponse.json({ error: 'Ingen varer valgt' }, { status: 400 });
  }

  const supa = createServerClient();

  // Fetch buyer institution and verify the caller actually belongs to it
  let buyer = null;
  if (body.buyerInstitutionId) {
    const { data } = await supa
      .from('institutions')
      .select('id, name, address, zipcode, city, email, phone, leader_email')
      .eq('id', body.buyerInstitutionId)
      .maybeSingle();
    buyer = data;

    if (buyer) {
      const userEmail = (user.email || '').toLowerCase();
      const directMatch = [buyer.email, buyer.leader_email]
        .filter(Boolean)
        .some(e => e.toLowerCase() === userEmail);
      if (!directMatch) {
        const { data: mem } = await supa
          .from('institution_members')
          .select('id')
          .eq('institution_id', buyer.id)
          .ilike('email', userEmail)
          .maybeSingle();
        if (!mem) {
          return NextResponse.json({ error: 'Du har ikke adgang til denne institution' }, { status: 403 });
        }
      }
    }
  }

  // Collect all listing IDs and fetch authoritative data from DB.
  const allListingIds = groups.flatMap(g => (g.items || []).map(i => i.listingId)).filter(Boolean);
  if (!allListingIds.length) {
    return NextResponse.json({ error: 'Ingen varer valgt' }, { status: 400 });
  }

  const [{ data: listings }, { data: shipOpts }] = await Promise.all([
    supa
      .from('listings')
      .select('id, title, price, emoji, category, type, user_id, institution_name, is_active, is_sold')
      .in('id', allListingIds),
    supa
      .from('shipping_options')
      .select('listing_id, shipping_size_category, allow_shipping, allow_pickup, allow_custom')
      .in('listing_id', allListingIds),
  ]);

  const listingMap = new Map((listings || []).map(l => [l.id, l]));
  const shipOptMap = new Map((shipOpts || []).map(s => [s.listing_id, s]));

  // Build order rows + compute grand total — all prices come from the database,
  // never from the client.
  const orderGroups = [];
  let grandTotal = 0;
  let metaBidMsgId = '';
  let metaConvId = body.conversationId || '';
  let metaDelivery = '';

  for (const g of groups) {
    if (!Array.isArray(g.items) || !g.items.length) {
      return NextResponse.json({ error: 'Tom varegruppe i kurven' }, { status: 400 });
    }

    let itemTotal = 0;
    const items = [];
    let sellerInstitutionName = null;
    let sellerUserId = null;

    for (const i of g.items) {
      const l = listingMap.get(i.listingId);
      if (!l) {
        return NextResponse.json({ error: 'Et opslag i kurven findes ikke længere' }, { status: 400 });
      }
      if (l.is_sold || l.is_active === false) {
        return NextResponse.json({ error: `"${l.title}" er ikke længere til salg` }, { status: 409 });
      }
      if (l.user_id && l.user_id === user.id) {
        return NextResponse.json({ error: 'Du kan ikke købe dine egne opslag' }, { status: 400 });
      }

      // Bid-mode: item price comes from an accepted bid in the conversation,
      // not listing.price. Reservationen udløber 24 timer efter accept.
      let itemPrice = l.price || 0;
      const fromBid = i.fromBid || i.bidMessageId;
      if (fromBid && body.conversationId) {
        const { data: bidMsg } = await supa
          .from('chat_messages')
          .select('id, bid_amount, bid_status')
          .eq('conversation_id', body.conversationId)
          .eq('bid_status', 'accepted')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!bidMsg) {
          return NextResponse.json({ error: 'Bud ikke fundet eller ikke accepteret' }, { status: 400 });
        }

        // 24-timers reservation: tjek mod checkout-beskedens oprettelsestidspunkt
        if (body.checkoutMessageId) {
          const { data: coMsg } = await supa
            .from('chat_messages')
            .select('created_at')
            .eq('id', body.checkoutMessageId)
            .maybeSingle();
          if (coMsg) {
            const deadline = new Date(coMsg.created_at).getTime() + 24 * 60 * 60 * 1000;
            if (Date.now() > deadline) {
              return NextResponse.json({ error: 'Tilbuddet er udløbet — buddet er ikke længere reserveret' }, { status: 409 });
            }
          }
        }

        itemPrice = bidMsg.bid_amount || 0;
        metaBidMsgId = metaBidMsgId || body.checkoutMessageId || bidMsg.id;
        metaConvId = metaConvId || body.conversationId;
      }

      itemTotal += itemPrice;
      sellerInstitutionName = sellerInstitutionName || l.institution_name;
      sellerUserId = sellerUserId || l.user_id;
      items.push({
        listingId: l.id,
        title: l.title,
        price: itemPrice,
        emoji: l.emoji,
        category: l.category,
        sizeCategory: shipOptMap.get(l.id)?.shipping_size_category || 'medium',
        ...(fromBid ? { fromBid: true } : {}),
      });
    }

    if (!metaDelivery && g.shippingMethod) metaDelivery = g.shippingMethod === 'pickup' || g.shippingMethod === 'custom' ? g.shippingMethod : 'shipping';

    // Validate shipping method server-side
    const sizeCategory = items[0]?.sizeCategory || 'medium';
    const shippingMethod = typeof g.shippingMethod === 'string' ? g.shippingMethod : null;

    // Fetch seller institution by the listing's institution name (authoritative),
    // falling back to the name supplied by the client. Hentes før pris-quote
    // fordi vi bruger sælgers postnummer som afsender.
    const sellerName = sellerInstitutionName || g.sellerName;
    let seller = null;
    if (sellerName) {
      const { data } = await supa
        .from('institutions')
        .select('id, name, email, phone, address, zipcode, city, bank_reg_nr, bank_account_nr, bundle_discount_enabled, bundle_discount_tiers')
        .ilike('name', sellerName)
        .maybeSingle();
      seller = data;
    }

    // Autoritativ fragtpris: live quote fra Shipmondo (inkl. moms), fallback til fast tabel.
    let shippingTotal = getShippingPrice(shippingMethod, sizeCategory);
    if (shippingTotal === null) {
      return NextResponse.json({ error: 'Ugyldig leveringsmetode' }, { status: 400 });
    }
    if (shippingMethod && shippingMethod !== 'pickup' && shippingMethod !== 'custom') {
      try {
        const carrier = shippingMethod.replace('parcel_shop_', '').replace('home_', '');
        const serviceType = shippingMethod.startsWith('parcel_shop_') ? 'parcel_shop' : 'home_delivery';
        const quote = await getPriceQuote({
          carrier,
          service_type: serviceType,
          size_category: sizeCategory,
          sender:   { name: seller?.name, address: seller?.address, zip: seller?.zipcode, city: seller?.city, email: seller?.email },
          receiver: { name: buyer?.name,  address: buyer?.address,  zip: buyer?.zipcode,  city: buyer?.city,  email: buyer?.email },
          service_point_id: g.pickupPoint?.id,
        });
        if (quote?.price_dkk > 0) shippingTotal = Math.round(quote.price_dkk * 100) / 100;
      } catch (e) {
        console.error('[create-intent] Shipmondo quote fejlede — bruger fast tabel:', e.message);
      }
    }

    // Bundle discount (applied before service fee)
    const bundleDiscount = calcBundleDiscount(itemTotal, items.length, seller);
    const discountedItemTotal = Math.round((itemTotal - bundleDiscount) * 100) / 100;

    const serviceFee = calcServiceFee(discountedItemTotal);
    const groupTotal = Math.round((discountedItemTotal + shippingTotal + serviceFee) * 100) / 100;
    grandTotal += groupTotal;

    orderGroups.push({
      sellerName: seller?.name || sellerName,
      sellerId: sellerUserId || g.sellerId || null,
      sellerInstitutionId: seller?.id || null,
      sellerEmail: seller?.email || null,
      sellerPhone: seller?.phone || null,
      sellerAddress: seller?.address || null,
      sellerZip: seller?.zipcode || null,
      sellerCity: seller?.city || null,
      sellerBankRegNr: seller?.bank_reg_nr || null,
      sellerBankAccountNr: seller?.bank_account_nr || null,
      items,
      itemTotal,
      bundleDiscount,
      discountedItemTotal,
      shippingTotal,
      serviceFee,
      groupTotal,
      shippingMethod,
      pickupPoint: g.pickupPoint
        ? { id: g.pickupPoint.id, name: g.pickupPoint.name, address: g.pickupPoint.address }
        : null,
      note: typeof g.note === 'string' ? g.note.slice(0, 1000) : null,
    });
  }

  grandTotal = Math.round(grandTotal * 100) / 100;

  // Create Stripe PaymentIntent (amount in øre)
  const amountOre = Math.round(grandTotal * 100);
  if (!Number.isInteger(amountOre) || amountOre < 250) {
    // Stripe minimum for DKK er 2,50 kr.
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
        buyer_id: user.id,
        buyer_institution_id: buyer?.id || '',
        buyer_name: buyer?.name || '',
        group_count: String(groups.length),
        bid_message_id: metaBidMsgId,
        conversation_id: metaConvId,
        delivery_method: metaDelivery,
      },
      description: `Bytogleg ordre — ${orderGroups.map(g => g.sellerName).join(', ')}`,
    });
  } catch (err) {
    console.error('[create-intent] Stripe fejl:', err.message);
    return NextResponse.json({ error: 'Betalingen kunne ikke oprettes — prøv igen' }, { status: 502 });
  }

  // Insert order record
  const { data: order, error } = await supa
    .from('orders')
    .insert({
      payment_intent_id: paymentIntent.id,
      buyer_id: user.id,
      buyer_institution_id: buyer?.id || null,
      buyer_name: buyer?.name || null,
      buyer_email: buyer?.email || user.email || null,
      buyer_phone: buyer?.phone || null,
      buyer_address: buyer?.address || null,
      buyer_zip: buyer?.zipcode || null,
      buyer_city: buyer?.city || null,
      grand_total: grandTotal,
      status: 'pending',
      order_groups: orderGroups,
    })
    .select()
    .single();

  if (error) {
    console.error('[create-intent] DB fejl:', error);
    // Annullér det forældreløse PaymentIntent så det ikke kan gennemføres uden ordre
    try { await stripe.paymentIntents.cancel(paymentIntent.id); } catch {}
    return NextResponse.json({ error: 'Kunne ikke oprette ordre' }, { status: 500 });
  }

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    orderId: order.id,
    grandTotal,
    breakdown: orderGroups.map(({ sellerBankRegNr, sellerBankAccountNr, ...rest }) => rest),
  });
}
