import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase-server';

// Vercel Cron: kører hver time (schedule i vercel.json: "0 * * * *").
// Annullerer bytteforslag hvor betalingsfristen (48t) er overskredet uden
// at begge parter har betalt, og refunderer den part der nåede at betale.
// Beskyttet af CRON_SECRET.

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY er ikke sat');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

export async function GET(req) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supa = createServerClient();
  const nowIso = new Date().toISOString();

  const { data: stale } = await supa
    .from('swap_proposals')
    .select('*')
    .in('escrow_status', ['awaiting_both', 'awaiting_initiator', 'awaiting_owner'])
    .lt('payment_deadline', nowIso);

  if (!stale?.length) {
    return NextResponse.json({ ok: true, cancelled: 0 });
  }

  const stripe = getStripe();
  let cancelled = 0;
  let refunded = 0;

  for (const p of stale) {
    // Refundér den/de part(er) der nåede at betale.
    for (const orderId of [p.initiator_order_id, p.owner_order_id].filter(Boolean)) {
      const { data: o } = await supa.from('orders').select('payment_intent_id, status').eq('id', orderId).maybeSingle();
      if (o?.payment_intent_id && o.status === 'paid') {
        try {
          await stripe.refunds.create({ payment_intent: o.payment_intent_id });
          refunded++;
        } catch (e) {
          console.error('[sweep-swap-deadlines] refusion fejl:', e.message);
        }
      }
    }

    await supa.from('swap_proposals')
      .update({ status: 'cancelled', escrow_status: 'cancelled_timeout' })
      .eq('id', p.id);

    // Frigiv reservationen på alle involverede varer.
    const ids = [...(p.offered_items || []), ...(p.requested_items || [])].map(i => i.listing_id).filter(Boolean);
    if (ids.length) {
      await supa.from('listings').update({ reserved_until: null, reserved_for_institution_id: null }).in('id', ids);
    }

    if (p.conversation_id) {
      const { data: c } = await supa.from('conversations').select('owner_unread, initiator_unread').eq('id', p.conversation_id).maybeSingle();
      await supa.from('conversations').update({
        last_message: '⏰ Byttehandel annulleret — betalingsfristen udløb.',
        last_message_at: nowIso,
        owner_unread: (c?.owner_unread || 0) + 1,
        initiator_unread: (c?.initiator_unread || 0) + 1,
      }).eq('id', p.conversation_id);
      await supa.from('chat_messages').insert({
        conversation_id: p.conversation_id,
        sender_id: p.initiator_id,
        sender_name: 'System',
        content: '⏰ Byttehandlen blev annulleret, fordi betalingsfristen (48 timer) udløb. Eventuelle betalte beløb refunderes automatisk.',
      });
    }
    cancelled++;
  }

  return NextResponse.json({ ok: true, cancelled, refunded });
}
