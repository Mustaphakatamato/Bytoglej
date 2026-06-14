import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const { orderId } = await req.json();
  if (!orderId) return NextResponse.json({ error: 'orderId mangler' }, { status: 400 });

  const supa = createServerClient();

  const { data: ownInst } = await supa.from('institutions')
    .select('id, name').ilike('email', user.email).maybeSingle();
  let instId = ownInst?.id ?? null;

  if (!instId) {
    const { data: mem } = await supa.from('institution_members')
      .select('institutions(id,name)').eq('email', user.email).maybeSingle();
    if (mem?.institutions) instId = mem.institutions.id;
  }

  const { data: order } = await supa.from('orders')
    .select('id, status, order_groups, buyer_id')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'Ordre ikke fundet' }, { status: 404 });
  if (order.status !== 'paid') return NextResponse.json({ error: 'Ordre er allerede markeret' }, { status: 400 });

  const isSeller = (order.order_groups || []).some(g =>
    (instId && g.sellerInstitutionId === instId) || g.sellerId === user.id
  );
  if (!isSeller) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });

  const now = new Date().toISOString();

  await supa.from('orders')
    .update({ status: 'shipped', shipped_at: now })
    .eq('id', orderId);

  const { data: msgs } = await supa.from('chat_messages')
    .select('conversation_id')
    .eq('message_type', 'payment_confirmed')
    .ilike('content', `%"orderId":"${orderId}"%`)
    .limit(1);

  const convId = msgs?.[0]?.conversation_id;
  if (convId) {
    const sellerName = ownInst?.name || 'Sælger';
    const msg = `Sælger har afsendt pakken. Hold øje med din e-mail for sporingsoplysninger.`;
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

  return NextResponse.json({ ok: true, convId });
}
