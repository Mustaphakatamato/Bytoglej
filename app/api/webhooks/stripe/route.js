import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase-server';
import { createShipment } from '@/lib/shipmondo/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] Ugyldig signatur:', err.message);
    return NextResponse.json({ error: 'Ugyldig webhook-signatur' }, { status: 400 });
  }

  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true });
  }

  const pi = event.data.object;
  const supa = createServerClient();

  const { data: order } = await supa
    .from('orders')
    .select('*')
    .eq('payment_intent_id', pi.id)
    .maybeSingle();

  if (!order) {
    console.error('[stripe-webhook] Ordre ikke fundet for:', pi.id);
    return NextResponse.json({ error: 'Ordre ikke fundet' }, { status: 404 });
  }

  // Mark as paid
  await supa.from('orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', order.id);

  const groups = order.order_groups || [];

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
      } catch (err) {
        console.error('[stripe-webhook] Shipmondo fejl:', err.message);
      }
    }

    // Send chat message to seller with payment confirmation
    const { data: sellerInst } = await supa
      .from('institutions')
      .select('id')
      .eq('id', g.sellerInstitutionId)
      .maybeSingle();

    const { data: buyerInst } = await supa
      .from('institutions')
      .select('id, name')
      .eq('id', order.buyer_institution_id)
      .maybeSingle();

    // Find or create conversation
    let convId;
    const firstItem = g.items?.[0];
    if (firstItem?.listingId) {
      const { data: existing } = await supa
        .from('conversations')
        .select('id')
        .eq('listing_id', firstItem.listingId)
        .eq('initiator_id', order.buyer_id)
        .maybeSingle();

      if (existing) {
        convId = existing.id;
      } else {
        const { data: conv } = await supa.from('conversations').insert({
          listing_id:               firstItem.listingId,
          listing_title:            firstItem.title,
          listing_emoji:            firstItem.emoji || '📦',
          initiator_id:             order.buyer_id,
          initiator_name:           buyerInst?.name || 'Køber',
          initiator_institution_id: order.buyer_institution_id,
          owner_id:                 g.sellerId,
          owner_name:               g.sellerName,
          owner_institution_id:     g.sellerInstitutionId,
          delivery_method:          'shipping',
        }).select().single();
        convId = conv?.id;
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
        sender_name:     buyerInst?.name || 'Køber',
        content:         JSON.stringify(msgContent),
        message_type:    'payment_confirmed',
      });

      await supa.from('conversations').update({
        last_message:    `Betaling bekræftet — ${g.items.map(i => i.title).join(', ')}`,
        last_message_at: new Date().toISOString(),
        owner_unread:    1,
        delivery_method: 'shipping',
      }).eq('id', convId);
    }

    // Update order group with shipment info
    if (shipmentResult) {
      await supa.from('orders').update({
        shipmondo_shipment_id: shipmentResult.shipmondo_shipment_id,
        tracking_number:       shipmentResult.tracking_number,
        tracking_url:          shipmentResult.tracking_url,
        label_pdf_url:         shipmentResult.label_pdf_url,
        status:                'shipped',
      }).eq('id', order.id);
    }
  }

  return NextResponse.json({ received: true });
}
