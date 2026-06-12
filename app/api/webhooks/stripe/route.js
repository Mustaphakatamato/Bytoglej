import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase-server';
import { createShipment } from '@/lib/shipmondo/client';

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

  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true });
  }

  const pi = event.data.object;

  // Idempotency: kun ét webhook-kald må behandle ordren.
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

  // Markér alle købte opslag som solgt
  const soldListingIds = groups.flatMap(g => (g.items || []).map(i => i.listingId)).filter(Boolean);
  if (soldListingIds.length) {
    await supa
      .from('listings')
      .update({
        is_sold: true,
        sold_at: new Date().toISOString(),
        sold_to: order.buyer_name || null,
        sold_to_institution_id: order.buyer_institution_id || null,
      })
      .in('id', soldListingIds);
  }

  const updatedGroups = [];
  let anyShipment = false;

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
        last_message:    `Betaling bekræftet — ${(g.items || []).map(i => i.title).join(', ')}`,
        last_message_at: new Date().toISOString(),
        owner_unread:    (conv?.owner_unread || 0) + 1,
        delivery_method: g.shippingMethod === 'pickup' || g.shippingMethod === 'custom' ? g.shippingMethod : 'shipping',
      }).eq('id', convId);
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
    ...(firstShipped ? {
      shipmondo_shipment_id: firstShipped.shipmondo_shipment_id,
      tracking_number:       firstShipped.tracking_number,
      tracking_url:          firstShipped.tracking_url,
      label_pdf_url:         firstShipped.label_pdf_url,
      status:                'shipped',
      shipped_at:            new Date().toISOString(),
    } : {}),
  }).eq('id', order.id);

  return NextResponse.json({ received: true, shipments_created: anyShipment });
}
