import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { createShipment, fetchShipmentLabel } from '@/lib/shipmondo/client';

// (Gen)genererer pakkemærkaten for sælgers gruppe på en betalt ordre.
// Bruges når label-bookingen fejlede ved betalingen (eller labelen mangler),
// så sælger aldrig sidder fast uden mærkat. Idempotent:
//   1. label findes allerede   → returnér den
//   2. forsendelse er booket   → hent labelen hos Shipmondo (ingen ny booking)
//   3. intet booket            → book forsendelsen og hent labelen
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: 'orderId mangler' }, { status: 400 });

  const supa = createServerClient();

  const { data: ownInst } = await supa.from('institutions')
    .select('id').ilike('email', user.email).maybeSingle();
  let instId = ownInst?.id ?? null;
  if (!instId) {
    const { data: mem } = await supa.from('institution_members')
      .select('institutions(id)').eq('email', user.email).maybeSingle();
    if (mem?.institutions) instId = mem.institutions.id;
  }

  const { data: order } = await supa.from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Ordre ikke fundet' }, { status: 404 });
  if (!['paid', 'shipped'].includes(order.status)) {
    return NextResponse.json({ error: 'Ordren er ikke klar til forsendelse' }, { status: 400 });
  }

  const groups = order.order_groups || [];
  const gi = groups.findIndex(g =>
    (instId && g.sellerInstitutionId === instId) || g.sellerId === user.id
  );
  if (gi < 0) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
  const g = groups[gi];

  if (g.label_pdf_url) {
    return NextResponse.json({ ok: true, label_pdf_url: g.label_pdf_url, tracking_number: g.tracking_number, tracking_url: g.tracking_url });
  }

  const isShipping = g.shippingMethod && (g.shippingMethod.startsWith('parcel_shop_') || g.shippingMethod.startsWith('home_'));
  if (!isShipping) {
    return NextResponse.json({ error: 'Denne ordre kræver ingen pakkemærkat (afhentning/egen aftale)' }, { status: 400 });
  }

  let result = null;
  try {
    if (g.shipmondo_shipment_id) {
      // Forsendelsen er allerede booket — hent kun labelen (ingen dobbelt-booking).
      const labelUrl = await fetchShipmentLabel(g.shipmondo_shipment_id);
      if (!labelUrl) {
        return NextResponse.json({ error: 'Labelen er endnu ikke klar hos Shipmondo. Prøv igen om lidt.' }, { status: 502 });
      }
      result = {
        shipmondo_shipment_id: g.shipmondo_shipment_id,
        tracking_number: g.tracking_number || null,
        tracking_url: g.tracking_url || null,
        label_pdf_url: labelUrl,
        price_dkk: null,
        rebooked: false,
      };
    } else {
      const carrierCode = g.shippingMethod.replace('parcel_shop_', '').replace('home_', '');
      const serviceType = g.shippingMethod.startsWith('parcel_shop_') ? 'parcel_shop' : 'home_delivery';
      const sizeCategory = g.items?.[0]?.sizeCategory || 'medium';
      const booked = await createShipment({
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
      result = { ...booked, rebooked: true };

      // Registrér i shipments-tabellen så Shipmondo-webhooken kan opdatere ordren.
      const convId = g.conversationId || await findConversationId(supa, orderId);
      if (convId) {
        const carrierEnum = { pdk: 'postnord', gls: 'gls', dao: 'dao' }[carrierCode] || null;
        const { error: shipRowErr } = await supa.from('shipments').insert({
          order_id:              order.id,
          conversation_id:       convId,
          seller_institution_id: g.sellerInstitutionId || null,
          buyer_institution_id:  order.buyer_institution_id || null,
          shipmondo_shipment_id: booked.shipmondo_shipment_id,
          carrier:               carrierEnum,
          service_type:          serviceType,
          size_category:         sizeCategory,
          cost_dkk:              booked.price_dkk,
          markup_dkk:            0,
          total_charged_to_seller_dkk: 0,
          prepaid:               true,
          tracking_number:       booked.tracking_number,
          tracking_url:          booked.tracking_url,
          label_pdf_url:         booked.label_pdf_url,
          pickup_point_id:       g.pickupPoint?.id || null,
          pickup_point_name:     g.pickupPoint?.name || null,
          pickup_point_address:  g.pickupPoint?.address || null,
          status:                'booked',
          booked_at:             new Date().toISOString(),
        });
        if (shipRowErr) console.error('[book-label] shipments-række fejl:', shipRowErr.message);
      }
    }
  } catch (e) {
    console.error('[book-label] fejl:', e.message);
    return NextResponse.json({ error: `Pakkemærkat kunne ikke oprettes: ${e.message}` }, { status: 502 });
  }

  // Gem label/tracking på gruppen + ryd fejlmarkeringen.
  groups[gi] = {
    ...g,
    shipmondo_shipment_id: result.shipmondo_shipment_id,
    tracking_number:       result.tracking_number,
    tracking_url:          result.tracking_url,
    label_pdf_url:         result.label_pdf_url,
    label_error:           null,
  };
  const firstShipped = groups.find(x => x.shipmondo_shipment_id);
  await supa.from('orders').update({
    order_groups: groups,
    shipment_error: null,
    ...(firstShipped ? {
      shipmondo_shipment_id: firstShipped.shipmondo_shipment_id,
      tracking_number:       firstShipped.tracking_number,
      tracking_url:          firstShipped.tracking_url,
      label_pdf_url:         firstShipped.label_pdf_url,
    } : {}),
  }).eq('id', orderId);

  return NextResponse.json({
    ok: true,
    label_pdf_url:   result.label_pdf_url,
    tracking_number: result.tracking_number,
    tracking_url:    result.tracking_url,
  });
}

async function findConversationId(supa, orderId) {
  const { data: msgs } = await supa.from('chat_messages')
    .select('conversation_id')
    .eq('message_type', 'payment_confirmed')
    .ilike('content', `%"orderId":"${orderId}"%`)
    .limit(1);
  return msgs?.[0]?.conversation_id || null;
}
