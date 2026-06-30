import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase-server';
import { createShipment } from '@/lib/shipmondo/client';
import { escapeHtml } from '@/lib/escape-html';
import { persistSwapCO2, persistTransactionCO2 } from '@/lib/co2/persist-server';
import { notify } from '@/lib/notify';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY er ikke sat');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  const stripe = getStripe();
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET er ikke sat');
    return NextResponse.json({ error: 'Webhook ikke konfigureret' }, { status: 500 });
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Ugyldig signatur:', err.message);
    return NextResponse.json({ error: 'Ugyldig webhook-signatur' }, { status: 400 });
  }

  const supa = createServerClient();

  // ── Fejlede betalinger: markér ordren som failed ──────────────
  if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
    const pi = event.data.object;
    await supa
      .from('orders')
      .update({ status: event.type === 'payment_intent.canceled' ? 'cancelled' : 'failed' })
      .eq('payment_intent_id', pi.id)
      .eq('status', 'pending');
    return NextResponse.json({ received: true });
  }

  // ── Refundering: markér ordren som refunded ──────────────────
  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    if (charge.payment_intent) {
      await supa
        .from('orders')
        .update({ status: 'refunded' })
        .eq('payment_intent_id', charge.payment_intent);
    }
    return NextResponse.json({ received: true });
  }

  // ── Byttehandel (byt): escrow med gensidig forsendelse ────────
  if (event.type === 'payment_intent.succeeded' && event.data.object.metadata?.type === 'swap') {
    if (event.data.object.metadata?.swap_proposal_id) {
      return handleSwapProposalPayment(event.data.object, supa);
    }
    return handleSwapPayment(event.data.object, supa);
  }

  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true });
  }

  return finalizePurchase(event.data.object, supa);
}

// ── Køb (køb/byd): finaliser betaling idempotent ──────────────────
// Udtrukket så den kan kaldes BÅDE fra webhooken OG fra klientens retur
// (/api/payments/finalize). Dermed opdaterer én gennemført betaling altid
// ordre, samtale, bud/tilbud og listings — uanset om webhooken nåede frem.
export async function finalizePurchase(pi, supa) {
  // Idempotency: kun ét kald må behandle ordren.
  // Atomisk pending → paid; hvis ingen række opdateres, er den allerede behandlet.
  const { data: claimed } = await supa
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('payment_intent_id', pi.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (!claimed) {
    const { data: existing } = await supa
      .from('orders')
      .select('id')
      .eq('payment_intent_id', pi.id)
      .maybeSingle();
    if (!existing) {
      console.error('[stripe-webhook] Ordre ikke fundet for:', pi.id);
      // 200 så Stripe ikke retry'er i det uendelige på en ordre der aldrig kommer
      return NextResponse.json({ received: true, warning: 'Ordre ikke fundet' });
    }
    return NextResponse.json({ received: true, already_processed: true });
  }

  const order = claimed;
  const groups = order.order_groups || [];

  // Bud-/tilbud-betalinger: markér bud/tilbud + samtale som gennemført.
  const bidMessageId = pi.metadata?.bid_message_id;
  const offerId      = pi.metadata?.offer_id;
  const bidConvId    = pi.metadata?.conversation_id;
  const bidDelivery  = pi.metadata?.delivery_method || '';
  if (bidMessageId || offerId || bidConvId) {
    const now = new Date().toISOString();
    const dealType = offerId ? 'køb' : 'byd';
    const dealUpdates = [];
    if (bidMessageId) {
      dealUpdates.push(
        supa.from('chat_messages')
          .update({ bid_status: 'checkout_done', bid_note: bidDelivery })
          .eq('id', bidMessageId)
      );
    }
    if (offerId) {
      dealUpdates.push(
        supa.from('offers').update({ status: 'completed' }).eq('id', offerId)
      );
    }
    if (bidConvId) {
      dealUpdates.push(
        supa.from('conversations').update({
          deal_completed: true,
          deal_completed_at: now,
          deal_type: dealType,
          delivery_method: bidDelivery,
          last_message: '🎉 Handel gennemført!',
          last_message_at: now,
        }).eq('id', bidConvId)
      );
    }
    await Promise.all(dealUpdates);
  }

  // Markér alle købte opslag som solgt
  const soldListingIds = groups.flatMap(g => (g.items || []).map(i => i.listingId)).filter(Boolean);
  if (soldListingIds.length) {
    await supa
      .from('listings')
      .update({
        is_sold: true,
        is_active: false,
        sold_at: new Date().toISOString(),
        sold_to: order.buyer_name || null,
        sold_to_institution_id: order.buyer_institution_id || null,
        reserved_until: null,
        reserved_for_institution_id: null,
      })
      .in('id', soldListingIds);
  }

  const updatedGroups = [];
  let anyShipment = false;
  let shipmentError = null;

  for (const g of groups) {
    let shipmentResult = null;

    // Create Shipmondo label if shipping (not pickup/custom)
    if (g.shippingMethod && (g.shippingMethod.startsWith('parcel_shop_') || g.shippingMethod.startsWith('home_'))) {
      const carrierCode = g.shippingMethod.replace('parcel_shop_', '').replace('home_', '');
      const serviceType = g.shippingMethod.startsWith('parcel_shop_') ? 'parcel_shop' : 'home_delivery';
      const sizeCategory = g.items?.[0]?.sizeCategory || 'medium';

      try {
        shipmentResult = await createShipment({
          sender: {
            name:         g.sellerName,
            address:      g.sellerAddress || 'Ukendt adresse',
            zip_code:     g.sellerZip || '2100',
            city:         g.sellerCity || 'København',
            country_code: 'DK',
            email:        g.sellerEmail,
            phone:        g.sellerPhone || '',
          },
          receiver: {
            name:         order.buyer_name || 'Køber',
            address:      order.buyer_address || 'Ukendt',
            zip_code:     order.buyer_zip || '2100',
            city:         order.buyer_city || 'København',
            country_code: 'DK',
            email:        order.buyer_email,
            phone:        order.buyer_phone || '',
          },
          carrier:        carrierCode,
          service_type:   serviceType,
          size_category:  sizeCategory,
          reference:      order.id,
          pickup_point_id: g.pickupPoint?.id || undefined,
        });
        anyShipment = true;
      } catch (err) {
        console.error('[stripe-webhook] Shipmondo fejl:', err.message);
        shipmentError = err.message;
      }
    }

    const { data: buyerInst } = await supa
      .from('institutions')
      .select('id, name')
      .eq('id', order.buyer_institution_id)
      .maybeSingle();

    // Find or create conversation
    let convId;
    let conv = null;
    const firstItem = g.items?.[0];
    if (firstItem?.listingId) {
      const { data: existingConvs } = await supa
        .from('conversations')
        .select('id, owner_unread')
        .eq('listing_id', firstItem.listingId)
        .eq('initiator_id', order.buyer_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingConvs?.length) {
        conv = existingConvs[0];
        convId = conv.id;
      } else {
        const { data: newConv } = await supa.from('conversations').insert({
          listing_id:               firstItem.listingId,
          listing_title:            firstItem.title,
          listing_emoji:            firstItem.emoji || '📦',
          initiator_id:             order.buyer_id,
          initiator_name:           buyerInst?.name || order.buyer_name || 'Køber',
          initiator_institution_id: order.buyer_institution_id,
          initiator_unread:         0,
          owner_id:                 g.sellerId,
          owner_name:               g.sellerName,
          owner_institution_id:     g.sellerInstitutionId,
          owner_unread:             0,
          delivery_method:          'shipping',
        }).select().single();
        conv = newConv;
        convId = newConv?.id;
      }
    }

    if (convId) {
      const msgContent = {
        type: 'payment_confirmed',
        orderId: order.id,
        items: g.items,
        itemTotal: g.itemTotal,
        shippingTotal: g.shippingTotal,
        serviceFee: g.serviceFee,
        shippingMethod: g.shippingMethod,
        pickupPoint: g.pickupPoint,
        note: g.note,
        tracking: shipmentResult ? {
          tracking_number: shipmentResult.tracking_number,
          tracking_url:    shipmentResult.tracking_url,
          label_pdf_url:   shipmentResult.label_pdf_url,
        } : null,
      };

      await supa.from('chat_messages').insert({
        conversation_id: convId,
        sender_id:       order.buyer_id,
        sender_name:     buyerInst?.name || order.buyer_name || 'Køber',
        content:         JSON.stringify(msgContent),
        message_type:    'payment_confirmed',
      });

      await supa.from('conversations').update({
        last_message:    `Betaling bekræftet: ${(g.items || []).map(i => i.title).join(', ')}`,
        last_message_at: new Date().toISOString(),
        owner_unread:    (conv?.owner_unread || 0) + 1,
        delivery_method: g.shippingMethod === 'pickup' || g.shippingMethod === 'custom' ? g.shippingMethod : 'shipping',
      }).eq('id', convId);

      // CO2-besparelse for dette køb (server-side, idempotent pr. samtale).
      // Tidligere blev CO2 KUN registreret for bundt-bytter — betalte køb/bud
      // talte 0 kg, så profil-tallet rykkede sig aldrig. Det rettes her.
      const groupListingIds = (g.items || []).map(it => it.listingId).filter(Boolean);
      const { data: catRows } = groupListingIds.length
        ? await supa.from('listings').select('category').in('id', groupListingIds)
        : { data: [] };
      await persistTransactionCO2(supa, {
        transactionId: convId,
        dealType:      bidMessageId ? 'byd' : 'køb',
        sellerInstId:  g.sellerInstitutionId || null,
        buyerInstId:   order.buyer_institution_id || null,
        sellerName:    g.sellerName || null,
        buyerName:     buyerInst?.name || order.buyer_name || null,
        categoryIds:   (catRows || []).map(r => r.category).filter(Boolean),
      });
    }

    // Send bekræftelses-email til sælger via Resend
    if (g.sellerEmail) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'byt&leg <noreply@bytogleg.dk>',
            to: [g.sellerEmail],
            subject: `🎉 Du har solgt ${(g.items || []).map(i => i.title).join(', ')} på byt&leg!`,
            html: sellerOrderEmailHtml({
              sellerName:     g.sellerName,
              items:          g.items || [],
              itemTotal:      g.itemTotal,
              shippingMethod: g.shippingMethod,
              pickupPoint:    g.pickupPoint,
              labelUrl:       shipmentResult?.label_pdf_url || null,
              trackingNumber: shipmentResult?.tracking_number || null,
              orderId:        order.id,
            }),
          }),
        });
        if (!res.ok) {
          console.error('[stripe-webhook] Sælger-email fejl:', await res.text());
        }
      } catch (err) {
        console.error('[stripe-webhook] Sælger-email fejl:', err.message);
      }
    }

    updatedGroups.push(shipmentResult ? {
      ...g,
      shipmondo_shipment_id: shipmentResult.shipmondo_shipment_id,
      tracking_number:       shipmentResult.tracking_number,
      tracking_url:          shipmentResult.tracking_url,
      label_pdf_url:         shipmentResult.label_pdf_url,
    } : g);
  }

  // Gem tracking-info per gruppe (og på ordren for bagudkompatibilitet)
  const firstShipped = updatedGroups.find(g => g.shipmondo_shipment_id);
  await supa.from('orders').update({
    order_groups: updatedGroups,
    shipment_error: firstShipped ? null : shipmentError,
    ...(firstShipped ? {
      shipmondo_shipment_id: firstShipped.shipmondo_shipment_id,
      tracking_number:       firstShipped.tracking_number,
      tracking_url:          firstShipped.tracking_url,
      label_pdf_url:         firstShipped.label_pdf_url,
      status:                'shipped',
      shipped_at:            new Date().toISOString(),
    } : {}),
  }).eq('id', order.id);

  // Send bekræftelses-email til køber via Resend
  if (order.buyer_email) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'byt&leg <noreply@bytogleg.dk>',
          to: [order.buyer_email],
          subject: `Din ordre er bekræftet hos byt&leg`,
          html: buyerOrderEmailHtml({
            buyerName:  order.buyer_name,
            groups:     updatedGroups,
            orderId:    order.id,
            grandTotal: updatedGroups.reduce((s, g) => s + (g.itemTotal || 0) + (g.shippingTotal || 0) + (g.serviceFee || 0), 0),
          }),
        }),
      });
      if (!res.ok) {
        console.error('[stripe-webhook] Køber-email fejl:', await res.text());
      }
    } catch (err) {
      console.error('[stripe-webhook] Køber-email fejl:', err.message);
    }
  }

  return NextResponse.json({ received: true, shipments_created: anyShipment });
}

// ── Byttehandel: betaling fra én part ─────────────────────────
// Markerer parten betalt. Når BEGGE har betalt, bookes to forsendelser
// (initiator→ejer og ejer→initiator) og handlen markeres gennemført.
export async function handleSwapPayment(pi, supa) {
  const convId   = pi.metadata?.conversation_id;
  const party    = pi.metadata?.party === 'owner' ? 'owner' : 'initiator';
  const delivery = pi.metadata?.delivery_method || 'shipping';

  // Idempotency: kun ét webhook-kald må behandle denne betaling.
  const { data: claimed } = await supa
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('payment_intent_id', pi.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (!claimed) return NextResponse.json({ received: true, already_processed: true });
  if (!convId)  return NextResponse.json({ received: true, warning: 'Mangler samtale' });

  // Markér denne part betalt + gem leveringsvalg
  const paidField     = party === 'owner' ? 'swap_owner_paid' : 'swap_initiator_paid';
  const deliveryField = party === 'owner' ? 'swap_owner_delivery' : 'swap_initiator_delivery';
  await supa.from('conversations').update({ [paidField]: true, [deliveryField]: delivery }).eq('id', convId);

  const { data: conv } = await supa.from('conversations').select('*').eq('id', convId).maybeSingle();
  if (!conv) return NextResponse.json({ received: true });

  const now = new Date().toISOString();

  if (conv.swap_initiator_paid && conv.swap_owner_paid) {
    // Begge har betalt → book forsendelser for de parter der valgte pakke.
    const [{ data: initInst }, { data: ownerInst }] = await Promise.all([
      conv.initiator_institution_id ? supa.from('institutions').select('*').eq('id', conv.initiator_institution_id).maybeSingle() : Promise.resolve({ data: null }),
      conv.owner_institution_id     ? supa.from('institutions').select('*').eq('id', conv.owner_institution_id).maybeSingle()     : Promise.resolve({ data: null }),
    ]);

    // Forsendelse 1: initiator → ejer (initiators vare)
    const initShipmentId = (conv.swap_initiator_delivery !== 'custom' && !conv.swap_initiator_shipment_id)
      ? await bookSwapShipment(supa, conv, conv.swap_initiator_listing_id, initInst, ownerInst)
      : conv.swap_initiator_shipment_id;
    // Forsendelse 2: ejer → initiator (ejers vare)
    const ownerShipmentId = (conv.swap_owner_delivery !== 'custom' && !conv.swap_owner_shipment_id)
      ? await bookSwapShipment(supa, conv, conv.swap_owner_listing_id, ownerInst, initInst)
      : conv.swap_owner_shipment_id;

    await supa.from('conversations').update({
      swap_initiator_shipment_id: initShipmentId || null,
      swap_owner_shipment_id: ownerShipmentId || null,
      deal_completed: true,
      deal_completed_at: now,
      deal_type: 'byt',
      delivery_status: 'in_progress',
      last_message: '🎉 Byttehandel gennemført! Begge parter har betalt.',
      last_message_at: now,
      owner_unread: (conv.owner_unread || 0) + 1,
      initiator_unread: (conv.initiator_unread || 0) + 1,
    }).eq('id', convId);

    await supa.from('chat_messages').insert({
      conversation_id: convId,
      sender_id: claimed.buyer_id,
      sender_name: claimed.buyer_name || 'System',
      content: '🎉 Byttehandel gennemført! Begge parter har betalt. Pakkemærkater er klar.',
      message_type: 'swap_completed',
    });

    // Mark begge opslag som inaktive (byttet væk)
    const tradedIds = [conv.swap_initiator_listing_id, conv.swap_owner_listing_id].filter(Boolean);
    if (tradedIds.length) {
      await supa.from('listings').update({ is_sold: true, is_active: false, sold_at: now }).in('id', tradedIds);
    }

    // CO2-besparelse for byttet (server-side, idempotent pr. samtale).
    const { data: swapCatRows } = tradedIds.length
      ? await supa.from('listings').select('category').in('id', tradedIds)
      : { data: [] };
    await persistTransactionCO2(supa, {
      transactionId: convId,
      dealType:      'byt',
      sellerInstId:  conv.owner_institution_id,
      buyerInstId:   conv.initiator_institution_id,
      sellerName:    conv.owner_name,
      buyerName:     conv.initiator_name,
      categoryIds:   (swapCatRows || []).map(r => r.category).filter(Boolean),
    });
  } else {
    // Kun én part har betalt → besked om at afvente modparten.
    await supa.from('conversations').update({
      last_message: 'En part har betalt. Afventer den anden part.',
      last_message_at: now,
      owner_unread: (conv.owner_unread || 0) + 1,
      initiator_unread: (conv.initiator_unread || 0) + 1,
    }).eq('id', convId);
  }

  return NextResponse.json({ received: true });
}

// ── Bundt-bytte (swap_proposals): escrow pr. part ─────────────
// Markerer parten betalt. Når BEGGE har betalt, bookes to forsendelser
// (initiators bundt → ejer, ejers bundt → initiator), varerne markeres
// solgt og reservationen ryddes.
const SWAP_SIZE_RANK = { small: 1, medium: 2, large: 3 };
async function swapBundleSize(supa, listingIds) {
  if (!listingIds.length) return 'medium';
  const { data } = await supa.from('shipping_options').select('shipping_size_category').in('listing_id', listingIds);
  let best = 'medium', rank = 0;
  for (const s of (data || [])) {
    const r = SWAP_SIZE_RANK[s.shipping_size_category] || 2;
    if (r > rank) { rank = r; best = s.shipping_size_category; }
  }
  return best;
}

export async function handleSwapProposalPayment(pi, supa) {
  const proposalId = pi.metadata?.swap_proposal_id;
  const party    = pi.metadata?.party === 'owner' ? 'owner' : 'initiator';
  const delivery = pi.metadata?.delivery_method || 'shipping';

  // Idempotency: kun ét webhook-kald må markere DENNE betaling betalt.
  let { data: claimed } = await supa
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('payment_intent_id', pi.id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  // Hvis claim'et fejler er det enten en dublet-webhook ELLER et retry efter et
  // nedbrud midt i færdiggørelsen. Hent den allerede-betalte ordre, så færdiggørelsen
  // kan GENKØRES idempotent (escrow_status-guard nedenfor sikrer at en fuldført
  // handel ikke køres igen) — i stedet for at tabe handlen med penge trukket.
  const isRetry = !claimed;
  if (!claimed) {
    const { data: existing } = await supa.from('orders').select('*').eq('payment_intent_id', pi.id).maybeSingle();
    if (!existing || existing.status !== 'paid') {
      return NextResponse.json({ received: true, already_processed: true });
    }
    claimed = existing;
  }
  if (!proposalId) return NextResponse.json({ received: true, warning: 'Mangler forslag' });

  // Markér denne part betalt + gem leveringsvalg + ordre-id (til evt. refusion).
  const paidField     = party === 'owner' ? 'owner_paid' : 'initiator_paid';
  const deliveryField = party === 'owner' ? 'owner_delivery' : 'initiator_delivery';
  const orderField    = party === 'owner' ? 'owner_order_id' : 'initiator_order_id';
  await supa.from('swap_proposals')
    .update({ [paidField]: true, [deliveryField]: delivery, [orderField]: claimed.id })
    .eq('id', proposalId);

  const { data: p } = await supa.from('swap_proposals').select('*').eq('id', proposalId).maybeSingle();
  if (!p) return NextResponse.json({ received: true });

  const convId = p.conversation_id;
  const { data: conv } = convId
    ? await supa.from('conversations').select('*').eq('id', convId).maybeSingle()
    : { data: null };
  const now = new Date().toISOString();

  if (p.initiator_paid && p.owner_paid && p.escrow_status !== 'both_paid_released') {
    const [{ data: initInst }, { data: ownerInst }] = await Promise.all([
      p.initiator_institution_id ? supa.from('institutions').select('*').eq('id', p.initiator_institution_id).maybeSingle() : Promise.resolve({ data: null }),
      p.owner_institution_id     ? supa.from('institutions').select('*').eq('id', p.owner_institution_id).maybeSingle()     : Promise.resolve({ data: null }),
    ]);
    const offeredIds   = (p.offered_items   || []).map(i => i.listing_id).filter(Boolean);
    const requestedIds = (p.requested_items || []).map(i => i.listing_id).filter(Boolean);

    // Forsendelse 1: initiator → ejer (initiators bundt). EJER modtager denne pakke,
    // så den bookes til EJERS valgte udleveringssted, og EJERS leveringsvalg afgør
    // om der overhovedet bookes en label (custom = aftalt levering, ingen label).
    // Shipment-id'et persisteres STRAKS, så et retry efter nedbrud ikke dobbelt-booker.
    let initShipmentId = p.initiator_shipment_id || null;
    if (!initShipmentId && p.owner_delivery !== 'custom' && conv) {
      initShipmentId = await bookSwapShipment(supa, conv, offeredIds[0], initInst, ownerInst, await swapBundleSize(supa, offeredIds), p.owner_pickup?.id || null);
      if (initShipmentId) await supa.from('swap_proposals').update({ initiator_shipment_id: initShipmentId }).eq('id', proposalId);
    }
    // Forsendelse 2: ejer → initiator (ejers bundt). INITIATOR modtager denne pakke,
    // så den bookes til INITIATORS valgte udleveringssted + initiators leveringsvalg.
    let ownerShipmentId = p.owner_shipment_id || null;
    if (!ownerShipmentId && p.initiator_delivery !== 'custom' && conv) {
      ownerShipmentId = await bookSwapShipment(supa, conv, requestedIds[0], ownerInst, initInst, await swapBundleSize(supa, requestedIds), p.initiator_pickup?.id || null);
      if (ownerShipmentId) await supa.from('swap_proposals').update({ owner_shipment_id: ownerShipmentId }).eq('id', proposalId);
    }

    // Markér alle byttede varer solgt + ryd reservation.
    const tradedIds = [...offeredIds, ...requestedIds];
    if (tradedIds.length) {
      await supa.from('listings').update({
        is_sold: true, is_active: false, sold_at: now,
        reserved_until: null, reserved_for_institution_id: null,
      }).in('id', tradedIds);
    }

    // Bekræftelses-mails til begge parter med hver deres pakkemærkat (Trin 5).
    const shipmentIds = [initShipmentId, ownerShipmentId].filter(Boolean);
    const { data: shipRows } = shipmentIds.length
      ? await supa.from('shipments').select('id, tracking_number, tracking_url, label_pdf_url').in('id', shipmentIds)
      : { data: [] };
    const shipById = new Map((shipRows || []).map(s => [s.id, s]));
    await Promise.all([
      // initShipmentId = initiators udgående pakke; om den fik label afgøres af EJERS leveringsvalg.
      initInst?.email && sendSwapDoneEmail(initInst.email, initInst.name, shipById.get(initShipmentId), p.owner_delivery),
      ownerInst?.email && sendSwapDoneEmail(ownerInst.email, ownerInst.name, shipById.get(ownerShipmentId), p.initiator_delivery),
    ].filter(Boolean));

    // Skriv tracking + mærkat ind på hver parts ordre, så Mine ordrer kan vise/downloade dem.
    async function patchOrderShipment(orderId, shipment) {
      if (!orderId || !shipment) return;
      const { data: ord } = await supa.from('orders').select('order_groups').eq('id', orderId).maybeSingle();
      const groups = Array.isArray(ord?.order_groups) ? ord.order_groups : [];
      if (groups[0]) {
        groups[0] = { ...groups[0], tracking_number: shipment.tracking_number, tracking_url: shipment.tracking_url, label_pdf_url: shipment.label_pdf_url };
        await supa.from('orders').update({ order_groups: groups, status: 'shipped' }).eq('id', orderId);
      }
    }
    await Promise.all([
      patchOrderShipment(p.initiator_order_id, shipById.get(initShipmentId)),
      patchOrderShipment(p.owner_order_id, shipById.get(ownerShipmentId)),
    ]);

    // CO2-besparelse for byttet (server-side, Trin 5).
    if (convId) {
      const { data: catRows } = tradedIds.length
        ? await supa.from('listings').select('category').in('id', tradedIds)
        : { data: [] };
      await persistSwapCO2(supa, {
        transactionId: convId,
        ownerInstId: p.owner_institution_id,
        initiatorInstId: p.initiator_institution_id,
        ownerName: ownerInst?.name || null,
        initiatorName: initInst?.name || null,
        categoryIds: (catRows || []).map(r => r.category).filter(Boolean),
      });
    }

    if (convId) {
      // Kontant mellemlag: byt&leg holder beløbet og udbetaler manuelt til modtageren.
      const cashLine = (Number(p.cash_adjustment) > 0)
        ? ` Kontant mellemlag på ${p.cash_adjustment} kr. udbetales til modparten.`
        : '';
      // Sig kun "pakkemærkater er klar" hvis der faktisk blev booket forsendelse(r).
      const deliveryLine = shipmentIds.length > 0
        ? ' Pakkemærkater er klar.'
        : ' Aftal levering indbyrdes.';
      await supa.from('conversations').update({
        deal_completed: true, deal_completed_at: now, deal_type: 'byt',
        delivery_status: 'in_progress',
        last_message: '🎉 Byttehandel gennemført! Begge parter har betalt.',
        last_message_at: now,
        owner_unread: (conv?.owner_unread || 0) + 1,
        initiator_unread: (conv?.initiator_unread || 0) + 1,
      }).eq('id', convId);
      await supa.from('chat_messages').insert({
        conversation_id: convId,
        sender_id: claimed.buyer_id,
        sender_name: 'System',
        content: `🎉 Byttehandel gennemført! Begge parter har betalt —${deliveryLine}${cashLine}`,
        message_type: 'swap_completed',
      });
    }

    // FULDFØRT-markør sættes ALLERSIDST. Sker der et nedbrud undervejs, vil et
    // webhook-retry genkøre færdiggørelsen (guard = escrow_status ovenfor), og
    // shipment-id'erne er allerede persisteret, så intet dobbelt-bookes.
    await supa.from('swap_proposals').update({
      escrow_status: 'both_paid_released',
      completed_at: now,
      initiator_shipment_id: initShipmentId,
      owner_shipment_id: ownerShipmentId,
    }).eq('id', proposalId);
  } else {
    // Kun én part har betalt → opdatér escrow-tilstand + besked.
    // (Idempotent state-update kører altid; beskeder/nudges KUN ved første behandling,
    // så et dublet-webhook ikke dobbelt-tæller unread eller sender nudge igen.)
    await supa.from('swap_proposals')
      .update({ escrow_status: p.initiator_paid ? 'awaiting_owner' : 'awaiting_initiator' })
      .eq('id', proposalId);
    if (convId && !isRetry) {
      await supa.from('conversations').update({
        last_message: 'En part har betalt — afventer den anden part.',
        last_message_at: now,
        owner_unread: (conv?.owner_unread || 0) + 1,
        initiator_unread: (conv?.initiator_unread || 0) + 1,
      }).eq('id', convId);
    }
    // "Din tur"-nudge til den part der endnu mangler at betale (Trin 5):
    // både e-mail og en in-app notifikation (klokke-menuen).
    const owingInstId = p.initiator_paid ? p.owner_institution_id : p.initiator_institution_id;
    if (owingInstId && !isRetry) {
      const { data: oi } = await supa.from('institutions').select('email, name').eq('id', owingInstId).maybeSingle();
      if (oi?.email) await sendSwapNudgeEmail(oi.email, oi.name, p.payment_deadline);
      try {
        // Klokke + push (e-mail sendes allerede via nudge-skabelonen ovenfor).
        await notify(supa, {
          institutionId: owingInstId,
          institutionName: oi?.name || null,
          sendEmail: false,
          type: 'swap_payment_turn',
          title: 'Det er din tur at betale 🔄',
          body: 'Modparten har betalt sin del af byttehandlen. Betal din andel for at fuldføre handlen.',
          data: { proposal_id: p.id, conversation_id: convId || p.conversation_id },
          url: '/beskeder',
        });
      } catch (e) { console.error('[stripe-webhook] notifikation fejl:', e?.message); }
    }
  }

  return NextResponse.json({ received: true });
}

// Booker én forsendelse i en byttehandel og returnerer shipments.id (eller null).
async function bookSwapShipment(supa, conv, listingId, senderInst, receiverInst, sizeOverride, pickupPointId) {
  if (!senderInst || !receiverInst) return null;
  try {
    let sizeCategory = sizeOverride || 'medium';
    if (!sizeOverride && listingId) {
      const { data: so } = await supa.from('shipping_options').select('shipping_size_category').eq('listing_id', listingId).maybeSingle();
      sizeCategory = so?.shipping_size_category || 'medium';
    }
    const carrier = 'gls';
    const service_type = 'parcel_shop';
    const result = await createShipment({
      sender:   { name: senderInst.name,   address: senderInst.address || 'Ukendt', zip_code: senderInst.zipcode || '2100', city: senderInst.city || 'København', country_code: 'DK', email: senderInst.email, phone: senderInst.phone || '' },
      receiver: { name: receiverInst.name, address: receiverInst.address || 'Ukendt', zip_code: receiverInst.zipcode || '2100', city: receiverInst.city || 'København', country_code: 'DK', email: receiverInst.email, phone: receiverInst.phone || '' },
      carrier, service_type, size_category: sizeCategory,
      reference: conv.id,
      pickup_point_id: pickupPointId || null,
    });
    const { data: shipment } = await supa.from('shipments').insert({
      conversation_id: conv.id,
      seller_institution_id: senderInst.id,
      buyer_institution_id: receiverInst.id,
      shipmondo_shipment_id: result.shipmondo_shipment_id,
      carrier, service_type, size_category: sizeCategory,
      cost_dkk: result.price_dkk,
      markup_dkk: 0,
      // Bytte-fragt er FORUDBETALT af parterne ved checkout. Markér prepaid og
      // sæt seller-charge til 0, så månedscron'en ikke fakturerer den igen.
      total_charged_to_seller_dkk: 0,
      prepaid: true,
      tracking_number: result.tracking_number,
      tracking_url: result.tracking_url,
      label_pdf_url: result.label_pdf_url,
      status: 'booked',
      booked_at: new Date().toISOString(),
    }).select().single();
    return shipment?.id || null;
  } catch (e) {
    console.error('[stripe-webhook] swap shipment fejl:', e.message);
    return null;
  }
}

// ── Sælger-email ───────────────────────────────────────────────

const SHIPPING_LABELS = {
  parcel_shop_pdk: 'PostNord pakkeshop',
  parcel_shop_gls: 'GLS pakkeshop',
  home_dao:        'DAO hjemlevering',
  pickup:          'Afhentning',
  custom:          'Egen aftale',
};

function fmtKr(n) {
  return `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`;
}

function sellerOrderEmailHtml({ sellerName, items, itemTotal, shippingMethod, pickupPoint, labelUrl, trackingNumber, orderId }) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
  const name = escapeHtml(String(sellerName || 'sælger'));
  const methodLabel = SHIPPING_LABELS[shippingMethod] || 'Forsendelse';
  const isShipping = shippingMethod && shippingMethod !== 'pickup' && shippingMethod !== 'custom';

  const itemRows = (items || []).map(i => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #ECE6DA;font-size:14px;color:#16221C;">${escapeHtml(String(i.emoji || '📦'))} ${escapeHtml(String(i.title || 'Vare'))}</td>
          <td style="padding:10px 0;border-bottom:1px solid #ECE6DA;font-size:14px;color:#16221C;font-weight:700;text-align:right;white-space:nowrap;">${fmtKr(i.price)}</td>
        </tr>`).join('');

  const labelBox = isShipping
    ? (labelUrl
      ? `
      <div style="background:#E8F1EC;border:1px solid #CFE3D8;border-radius:14px;padding:18px 20px;margin:0 0 28px;">
        <div style="font-weight:800;font-size:14px;color:#133F2B;margin-bottom:6px;">📦 Din pakkemærkat er klar</div>
        <p style="font-size:13px;color:#3A473D;line-height:1.6;margin:0 0 14px;">
          Vi har oprettet en forsendelse med ${escapeHtml(methodLabel)}${trackingNumber ? `, tracking-nummer <strong>${escapeHtml(String(trackingNumber))}</strong>` : ''}.
        </p>
        <a href="${escapeHtml(String(labelUrl))}" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:10px 22px;border-radius:99px;">Download pakkemærkat (PDF) →</a>
      </div>`
      : `
      <div style="background:#E8F1EC;border:1px solid #CFE3D8;border-radius:14px;padding:18px 20px;margin:0 0 28px;">
        <div style="font-weight:800;font-size:14px;color:#133F2B;margin-bottom:6px;">📦 Pakkemærkat er på vej</div>
        <p style="font-size:13px;color:#3A473D;line-height:1.6;margin:0;">
          Din pakkemærkat til ${escapeHtml(methodLabel)} sendes snarest til denne e-mail. Du kan pakke varen, mens du venter.
        </p>
      </div>`)
    : `
      <div style="background:#E8F1EC;border:1px solid #CFE3D8;border-radius:14px;padding:18px 20px;margin:0 0 28px;">
        <div style="font-weight:800;font-size:14px;color:#133F2B;margin-bottom:6px;">🤝 Levering: ${escapeHtml(methodLabel)}</div>
        <p style="font-size:13px;color:#3A473D;line-height:1.6;margin:0;">
          Køberen har valgt ${shippingMethod === 'pickup' ? 'at afhente varen hos jer' : 'en egen leveringsaftale'}. Aftal nærmere via beskeder på byt&amp;leg.
        </p>
      </div>`;

  const steps = isShipping
    ? [
      { icon: '📦', text: 'Pak varen forsvarligt, så den ikke tager skade undervejs.' },
      { icon: '🖨️', text: 'Print pakkemærkaten og sæt den på pakken.' },
      { icon: '📍', text: `Aflever pakken på nærmeste ${methodLabel.includes('hjemlevering') ? 'afleveringssted' : methodLabel.toLowerCase()} eller afleveringssted.` },
    ]
    : [
      { icon: '💬', text: 'Aftal tid og sted for afhentning med køberen via beskeder på byt&amp;leg.' },
      { icon: '🤝', text: 'Overdrag varen til køberen ved afhentningen.' },
    ];

  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:580px;margin:48px auto 32px;">

    <!-- Header -->
    <div style="background-color:#1B4332;background:linear-gradient(160deg,#133F2B 0%,#2A7D4F 100%);border-radius:20px 20px 0 0;padding:44px 44px 36px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:14px;padding:10px 22px;color:#fff;font-size:26px;font-weight:900;letter-spacing:-0.04em;margin-bottom:20px;">byt<span style="opacity:0.55">&amp;</span>leg.</div>
      <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0 0 10px;letter-spacing:-0.03em;">Tillykke, du har solgt noget! 🎉</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0;line-height:1.55;">Betalingen er modtaget og bekræftet. ${isShipping ? 'Nu skal varen bare afsted.' : 'Nu skal varen bare overdrages.'}</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:40px 44px;border-left:1px solid rgba(22,34,28,0.08);border-right:1px solid rgba(22,34,28,0.08);">
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 28px;">
        Hej ${name},<br><br>
        En køber har netop betalt for følgende varer via byt&amp;leg:
      </p>

      <!-- Solgte varer -->
      <table style="width:100%;border-collapse:collapse;margin:0 0 8px;">
        <tr>
          <th style="padding:0 0 8px;border-bottom:2px solid #DAD3C4;font-size:11px;color:#6B7570;text-transform:uppercase;letter-spacing:0.06em;text-align:left;">Vare</th>
          <th style="padding:0 0 8px;border-bottom:2px solid #DAD3C4;font-size:11px;color:#6B7570;text-transform:uppercase;letter-spacing:0.06em;text-align:right;">Pris</th>
        </tr>${itemRows}
        <tr>
          <td style="padding:12px 0 0;font-size:14px;color:#16221C;font-weight:800;">I alt</td>
          <td style="padding:12px 0 0;font-size:15px;color:#2A7D4F;font-weight:800;text-align:right;white-space:nowrap;">${fmtKr(itemTotal)}</td>
        </tr>
      </table>
      <p style="font-size:12px;color:#6B7570;margin:0 0 28px;">Ordrenummer: ${escapeHtml(String(orderId || ''))}${pickupPoint ? `<br>Afhentningssted: ${escapeHtml(String(pickupPoint.name || ''))}${pickupPoint.address ? `, ${escapeHtml(String(pickupPoint.address))}` : ''}` : ''}</p>

      ${labelBox}

      <!-- Sådan gør du -->
      <div style="font-weight:800;font-size:14px;color:#16221C;margin:0 0 14px;">Sådan gør du:</div>
      ${steps.map((s, i) => `
      <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start;">
        <div style="flex-shrink:0;width:36px;height:36px;background:#e8f5ee;border-radius:10px;font-size:18px;text-align:center;line-height:36px;">${s.icon}</div>
        <div style="flex:1;font-size:14px;color:#3A473D;line-height:1.55;padding-top:8px;"><strong>${i + 1}.</strong> ${s.text}</div>
      </div>`).join('')}

      <!-- Udbetaling -->
      <div style="background:#F6F2EA;border-radius:14px;padding:16px 20px;margin:24px 0 0;">
        <div style="font-weight:800;font-size:13px;color:#16221C;margin-bottom:4px;">💰 Hvornår modtager du pengene?</div>
        <p style="font-size:13px;color:#6B7570;line-height:1.6;margin:0;">
          byt&amp;leg holder beløbet sikkert, indtil køberen har modtaget varen. Når leveringen er bekræftet, overfører vi <strong style="color:#2A7D4F;">${fmtKr(itemTotal)}</strong> til jeres konto.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#F6F2EA;border-radius:0 0 20px 20px;border:1px solid rgba(22,34,28,0.08);border-top:none;padding:24px 44px;text-align:center;">
      <p style="font-size:13px;color:#6B7570;margin:0 0 8px;">Spørgsmål? Skriv til os på <a href="mailto:kontakt@bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">kontakt@bytogleg.dk</a></p>
      <p style="font-size:12px;color:#DAD3C4;margin:0;">© 2025 byt&amp;leg · <a href="${base}/privatlivspolitik" style="color:#DAD3C4;text-decoration:none;">Privatlivspolitik</a></p>
    </div>

  </div>
</body>
</html>`;
}

// ── Køber-email ────────────────────────────────────────────────

// ── Bytte-mails (Trin 5) ───────────────────────────────────────

async function sendSwapEmail(to, subject, html) {
  if (!to || !process.env.RESEND_API_KEY) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'byt&leg <noreply@bytogleg.dk>', to: [to], subject, html }),
    });
    if (!res.ok) console.error('[stripe-webhook] bytte-email fejl:', await res.text());
  } catch (err) {
    console.error('[stripe-webhook] bytte-email fejl:', err.message);
  }
}

function swapEmailShell(title, intro, bodyHtml) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
  return `<!DOCTYPE html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:48px auto 32px;background:#FDFAF4;border-radius:20px;overflow:hidden;border:1px solid rgba(22,34,28,0.08);">
    <div style="background:linear-gradient(160deg,#1B4332 0%,#2A7D4F 100%);padding:40px;text-align:center;">
      <span style="display:inline-block;background:rgba(255,255,255,0.13);border-radius:14px;padding:10px 22px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.04em;">byt<span style="opacity:0.6">&amp;</span>leg.</span>
    </div>
    <div style="padding:40px;">
      <h1 style="font-size:23px;font-weight:800;color:#16221C;margin:0 0 14px;letter-spacing:-0.03em;">${title}</h1>
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 22px;">${intro}</p>
      ${bodyHtml}
      <div style="text-align:center;margin:32px 0 4px;">
        <a href="${base}/beskeder" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 34px;border-radius:99px;">Se byttehandlen →</a>
      </div>
    </div>
    <div style="background:#F6F2EA;padding:20px 40px;border-top:1px solid rgba(22,34,28,0.06);text-align:center;">
      <p style="font-size:12px;color:#6B7570;margin:0;">byt&amp;leg &middot; <a href="https://bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">bytogleg.dk</a></p>
    </div>
  </div>
</body></html>`;
}

async function sendSwapDoneEmail(to, name, shipment, delivery) {
  const greeting = name ? `Hej ${escapeHtml(String(name))},` : 'Hej,';
  let box;
  if (delivery === 'custom') {
    box = `<div style="background:#E8F1EC;border:1px solid #CFE3D8;border-radius:14px;padding:18px 20px;">
      <div style="font-weight:800;font-size:14px;color:#133F2B;margin-bottom:6px;">🤝 Aftalt levering</div>
      <p style="font-size:13px;color:#3A473D;line-height:1.6;margin:0;">I har valgt selv at aftale leveringen — koordinér nærmere via beskeder på byt&amp;leg.</p>
    </div>`;
  } else if (shipment?.label_pdf_url) {
    box = `<div style="background:#E8F1EC;border:1px solid #CFE3D8;border-radius:14px;padding:18px 20px;">
      <div style="font-weight:800;font-size:14px;color:#133F2B;margin-bottom:6px;">📦 Din pakkemærkat er klar</div>
      ${shipment.tracking_number ? `<p style="font-size:13px;color:#3A473D;line-height:1.6;margin:0 0 12px;">Tracking-nummer: <strong>${escapeHtml(String(shipment.tracking_number))}</strong></p>` : ''}
      <a href="${escapeHtml(String(shipment.label_pdf_url))}" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:10px 22px;border-radius:99px;">Download pakkemærkat (PDF) →</a>
    </div>`;
  } else {
    box = `<div style="background:#E8F1EC;border:1px solid #CFE3D8;border-radius:14px;padding:18px 20px;">
      <div style="font-weight:800;font-size:14px;color:#133F2B;margin-bottom:6px;">📦 Pakkemærkat på vej</div>
      <p style="font-size:13px;color:#3A473D;line-height:1.6;margin:0;">Din pakkemærkat gøres klar — du finder den i beskeder på byt&amp;leg.</p>
    </div>`;
  }
  const html = swapEmailShell(
    'Byttehandel gennemført! 🎉',
    `${greeting}<br><br>Begge parter har betalt, og jeres byttehandel er nu gennemført.`,
    box
  );
  await sendSwapEmail(to, '🎉 Din byttehandel er gennemført — byt&leg', html);
}

async function sendSwapNudgeEmail(to, name, deadline) {
  const greeting = name ? `Hej ${escapeHtml(String(name))},` : 'Hej,';
  const frist = deadline ? new Date(deadline).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  const html = swapEmailShell(
    'Det er din tur at betale 🔄',
    `${greeting}<br><br>Den anden part har betalt sin andel af jeres byttehandel. Betal din andel for at gennemføre byttet${frist ? ` — inden <strong>${escapeHtml(frist)}</strong>` : ''}. Ellers annulleres handlen automatisk, og betalte beløb refunderes.`,
    ''
  );
  await sendSwapEmail(to, 'Din byttehandel afventer din betaling — byt&leg', html);
}

function buyerOrderEmailHtml({ buyerName, groups, orderId, grandTotal }) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
  const name = escapeHtml(String(buyerName || 'køber'));

  const anyShipping = (groups || []).some(g => g.shippingMethod && g.shippingMethod !== 'pickup' && g.shippingMethod !== 'custom');
  const anyPickup = (groups || []).some(g => g.shippingMethod === 'pickup');

  const groupRows = (groups || []).map(g => {
    const itemRows = (g.items || []).map(i => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #ECE6DA;font-size:13px;color:#16221C;">${escapeHtml(String(i.emoji || '📦'))} ${escapeHtml(String(i.title || 'Vare'))}</td>
          <td style="padding:8px 0;border-bottom:1px solid #ECE6DA;font-size:13px;color:#16221C;font-weight:700;text-align:right;white-space:nowrap;">${fmtKr(i.price)}</td>
        </tr>`).join('');

    const methodLabel = SHIPPING_LABELS[g.shippingMethod] || 'Forsendelse';
    const isShipping = g.shippingMethod && g.shippingMethod !== 'pickup' && g.shippingMethod !== 'custom';

    const deliveryLine = isShipping
      ? `<tr><td style="padding:6px 0;font-size:12px;color:#6B7570;">Levering (${escapeHtml(methodLabel)})</td><td style="padding:6px 0;font-size:12px;color:#6B7570;text-align:right;">${fmtKr(g.shippingTotal)}</td></tr>`
      : `<tr><td style="padding:6px 0;font-size:12px;color:#6B7570;">${escapeHtml(methodLabel)}</td><td style="padding:6px 0;font-size:12px;color:#6B7570;text-align:right;">—</td></tr>`;

    return `
      <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #ECE6DA;">
        <div style="font-size:12px;font-weight:700;color:#6B7570;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Fra ${escapeHtml(String(g.sellerName || 'sælger'))}</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="padding:0 0 6px;border-bottom:2px solid #DAD3C4;font-size:11px;color:#6B7570;text-transform:uppercase;letter-spacing:0.06em;text-align:left;">Vare</th>
            <th style="padding:0 0 6px;border-bottom:2px solid #DAD3C4;font-size:11px;color:#6B7570;text-transform:uppercase;letter-spacing:0.06em;text-align:right;">Pris</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-top:6px;">
          ${deliveryLine}
          <tr><td style="padding:6px 0;font-size:12px;color:#6B7570;">Bytogleg beskyttelse</td><td style="padding:6px 0;font-size:12px;color:#6B7570;text-align:right;">${fmtKr(g.serviceFee)}</td></tr>
        </table>
        ${isShipping && g.pickupPoint ? `<div style="font-size:12px;color:#6B7570;margin-top:6px;">Afhentningssted: ${escapeHtml(String(g.pickupPoint.name || ''))}${g.pickupPoint.address ? `, ${escapeHtml(String(g.pickupPoint.address))}` : ''}</div>` : ''}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:580px;margin:48px auto 32px;">

    <!-- Header -->
    <div style="background-color:#1B4332;background:linear-gradient(160deg,#133F2B 0%,#2A7D4F 100%);border-radius:20px 20px 0 0;padding:44px 44px 36px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:14px;padding:10px 22px;color:#fff;font-size:26px;font-weight:900;letter-spacing:-0.04em;margin-bottom:20px;">byt<span style="opacity:0.55">&amp;</span>leg.</div>
      <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0 0 10px;letter-spacing:-0.03em;">Din betaling er gennemført! 🎉</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0;line-height:1.55;">${anyShipping ? 'Sælger er notificeret og pakker varen til dig.' : 'Sælger er notificeret. Aftal afhentning i beskeder.'}</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:40px 44px;border-left:1px solid rgba(22,34,28,0.08);border-right:1px solid rgba(22,34,28,0.08);">
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 28px;">
        Hej ${name},<br><br>
        Tak for dit køb! Her er en oversigt over din ordre.
      </p>

      ${groupRows}

      <!-- Total -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0 0;border-top:2px solid #16221C;">
        <span style="font-size:15px;font-weight:800;color:#16221C;">I alt betalt</span>
        <span style="font-size:18px;font-weight:800;color:#2A7D4F;">${fmtKr(grandTotal)}</span>
      </div>
      <p style="font-size:12px;color:#6B7570;margin:6px 0 28px;">Ordrenummer: ${escapeHtml(String(orderId || ''))}</p>

      <!-- Beskyttelse -->
      <div style="background:#E8F1EC;border:1px solid #CFE3D8;border-radius:14px;padding:18px 20px;margin-bottom:28px;">
        <div style="font-weight:800;font-size:14px;color:#133F2B;margin-bottom:6px;">🛡️ Du er dækket af Bytogleg beskyttelse</div>
        <p style="font-size:13px;color:#3A473D;line-height:1.6;margin:0;">
          Hvis varen ikke ankommer eller ikke matcher beskrivelsen, hjælper vi dig med at få dine penge tilbage.
        </p>
      </div>

      <!-- Hvad sker der nu -->
      <div style="font-weight:800;font-size:14px;color:#16221C;margin:0 0 14px;">Hvad sker der nu?</div>
      ${[
        ...(anyShipping ? [
          { icon: '📦', text: 'Sælger pakker varen og printer pakkemærkaten.' },
          { icon: '🚚', text: 'Du modtager en notifikation når pakken er sendt.' },
          { icon: '🏠', text: 'Pakken leveres til dit valgte afhentningssted.' },
        ] : []),
        ...(anyPickup ? [
          { icon: '💬', text: 'Aftal tid og sted for afhentning med sælger via beskeder på byt&amp;leg.' },
          { icon: '🤝', text: 'Du henter varen hos sælger på det aftalte tidspunkt.' },
        ] : []),
      ].map((s, i) => `
      <div style="display:flex;gap:14px;margin-bottom:14px;align-items:flex-start;">
        <div style="flex-shrink:0;width:34px;height:34px;background:#e8f5ee;border-radius:10px;font-size:17px;text-align:center;line-height:34px;">${s.icon}</div>
        <div style="flex:1;font-size:13px;color:#3A473D;line-height:1.55;padding-top:7px;">${s.text}</div>
      </div>`).join('')}

      <!-- CTA -->
      <div style="text-align:center;margin-top:28px;">
        <a href="${base}/beskeder" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 32px;border-radius:99px;">Følg din ordre i beskeder →</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#F6F2EA;border-radius:0 0 20px 20px;border:1px solid rgba(22,34,28,0.08);border-top:none;padding:24px 44px;text-align:center;">
      <p style="font-size:13px;color:#6B7570;margin:0 0 8px;">Spørgsmål? Skriv til os på <a href="mailto:kontakt@bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">kontakt@bytogleg.dk</a></p>
      <p style="font-size:12px;color:#DAD3C4;margin:0;">© 2025 byt&amp;leg · <a href="${base}/privatlivspolitik" style="color:#DAD3C4;text-decoration:none;">Privatlivspolitik</a></p>
    </div>

  </div>
</body>
</html>`;
}
