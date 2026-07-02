import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { notify } from '@/lib/notify';

// Sælger markerer en ordre som afsendt (eller afhentet ved pickup).
// Ordren er 'paid' indtil dette kald — label-booking ændrer IKKE status.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: 'orderId mangler' }, { status: 400 });

  const supa = createServerClient();

  const { data: ownInst } = await supa.from('institutions')
    .select('id, name').ilike('email', user.email).maybeSingle();
  let instId = ownInst?.id ?? null;
  let instName = ownInst?.name ?? null;

  if (!instId) {
    const { data: mem } = await supa.from('institution_members')
      .select('institutions(id,name)').eq('email', user.email).maybeSingle();
    if (mem?.institutions) { instId = mem.institutions.id; instName = mem.institutions.name; }
  }

  const { data: order } = await supa.from('orders')
    .select('id, status, order_groups, buyer_id, buyer_institution_id, buyer_name, order_number')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'Ordre ikke fundet' }, { status: 404 });

  const myGroup = (order.order_groups || []).find(g =>
    (instId && g.sellerInstitutionId === instId) || g.sellerId === user.id
  );
  if (!myGroup) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });

  // Idempotent: allerede markeret afsendt/leveret → OK uden nye beskeder.
  if (order.status === 'shipped' || order.status === 'delivered') {
    return NextResponse.json({ ok: true, already_marked: true, status: order.status });
  }
  if (order.status !== 'paid') {
    return NextResponse.json({ error: 'Ordren kan ikke markeres afsendt endnu' }, { status: 400 });
  }

  const now = new Date().toISOString();

  await supa.from('orders')
    .update({ status: 'shipped', shipped_at: now })
    .eq('id', orderId);

  const isPickup = myGroup.shippingMethod === 'pickup' || myGroup.shippingMethod === 'custom';
  const sellerName = instName || myGroup.sellerName || 'Sælger';

  // Chat-besked til køber — med tracking direkte i beskeden (ikke "tjek din e-mail").
  const convId = myGroup.conversationId || await findConversationId(supa, orderId);
  if (convId) {
    // Afhentnings-/aftalt-ordrer har ingen pakke — beskeden skal matche det,
    // ikke tale om "afsendt pakke". Tracking sendes direkte i beskeden.
    const msg = isPickup
      ? `🤝 ${sellerName} har markeret varen som klar til afhentning. Aftal tid og sted her i beskeder.`
      : myGroup.tracking_url
        ? `🚚 ${sellerName} har afsendt pakken. Følg den her: ${myGroup.tracking_url}`
        : myGroup.tracking_number
          ? `🚚 ${sellerName} har afsendt pakken. Trackingnummer: ${myGroup.tracking_number}`
          : `🚚 ${sellerName} har afsendt pakken.`;
    await supa.from('chat_messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      sender_name: sellerName,
      content: msg,
    });
    await supa.from('conversations').update({
      last_message: msg,
      last_message_at: now,
      initiator_unread: 1,
    }).eq('id', convId);
  }

  // Klokke + push + e-mail til køber.
  try {
    await notify(supa, {
      institutionId: order.buyer_institution_id,
      institutionName: order.buyer_name,
      type: 'order_shipped',
      title: isPickup ? '🤝 Din vare er klar til afhentning' : '🚚 Din pakke er sendt',
      body: isPickup
        ? `${sellerName} har markeret din vare som klar til afhentning. Aftal tid og sted i beskeder.`
        : `${sellerName} har afsendt din pakke.${myGroup.tracking_number ? ` Trackingnummer: ${myGroup.tracking_number}` : ''}`,
      data: { order_id: orderId, conversation_id: convId || null, tracking_url: myGroup.tracking_url || null },
      url: `/mine-ordrer?order=${orderId}`,
    });
  } catch (e) { console.error('[seller-mark-sent] notify fejl:', e?.message); }

  return NextResponse.json({ ok: true, convId });
}

// Ældre ordrer har ikke conversationId gemt i gruppen — find den via
// payment_confirmed-beskeden ligesom før.
async function findConversationId(supa, orderId) {
  const { data: msgs } = await supa.from('chat_messages')
    .select('conversation_id')
    .eq('message_type', 'payment_confirmed')
    .ilike('content', `%"orderId":"${orderId}"%`)
    .limit(1);
  return msgs?.[0]?.conversation_id || null;
}
