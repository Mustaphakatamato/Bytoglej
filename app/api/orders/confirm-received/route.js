import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { notify } from '@/lib/notify';
import { creditOrderOnDelivery } from '@/lib/wallet';
import { issueAfregningForDelivery } from '@/lib/documents';

// Køber bekræfter modtagelse af en ordre. Kører med service role, fordi
// købere ikke har (og ikke skal have) UPDATE-adgang til orders via RLS.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: 'orderId mangler' }, { status: 400 });

  const supa = createServerClient();

  const { data: order } = await supa.from('orders')
    .select('id, status, buyer_id, buyer_name, order_groups, order_number')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'Ordre ikke fundet' }, { status: 404 });
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });

  if (order.status === 'delivered') {
    return NextResponse.json({ ok: true, already_delivered: true });
  }
  if (!['paid', 'shipped'].includes(order.status)) {
    return NextResponse.json({ error: 'Ordren kan ikke bekræftes modtaget' }, { status: 400 });
  }

  const now = new Date().toISOString();
  await supa.from('orders')
    .update({ status: 'delivered', delivered_at: now })
    .eq('id', orderId);

  // Sæt sælgers indtjening ind på deres byt&leg-konto (idempotent).
  await creditOrderOnDelivery(supa, orderId);
  // Udsted afregningsbilag til hver sælger (best-effort, idempotent).
  await issueAfregningForDelivery(supa, orderId).catch(e => console.error('[confirm-received] afregning-fejl:', e?.message));

  // Besked i samtalen + notifikation til hver sælger på ordren.
  const buyerName = order.buyer_name || 'Køber';
  const notifiedConvs = new Set();
  for (const g of (order.order_groups || [])) {
    const convId = g.conversationId || await findConversationId(supa, orderId);
    if (convId && !notifiedConvs.has(convId)) {
      notifiedConvs.add(convId);
      const msg = `✅ ${buyerName} har bekræftet modtagelse af varen.`;
      await supa.from('chat_messages').insert({
        conversation_id: convId,
        sender_id: user.id,
        sender_name: buyerName,
        content: msg,
      });
      await supa.from('conversations').update({
        last_message: msg,
        last_message_at: now,
        owner_unread: 1,
        delivery_status: 'completed',
      }).eq('id', convId);
    }
    try {
      await notify(supa, {
        institutionId: g.sellerInstitutionId,
        institutionName: g.sellerName,
        type: 'order_delivered',
        title: '✅ Køber har modtaget varen',
        body: `${buyerName} har bekræftet modtagelse af ${(g.items || []).map(i => i.title).join(', ')}. Beløbet er sat ind på jeres byt&leg-konto.`,
        data: { order_id: orderId, conversation_id: convId || null },
        url: '/mine-opgaver',
      });
    } catch (e) { console.error('[confirm-received] notify fejl:', e?.message); }
  }

  return NextResponse.json({ ok: true });
}

async function findConversationId(supa, orderId) {
  const { data: msgs } = await supa.from('chat_messages')
    .select('conversation_id')
    .eq('message_type', 'payment_confirmed')
    .ilike('content', `%"orderId":"${orderId}"%`)
    .limit(1);
  return msgs?.[0]?.conversation_id || null;
}
