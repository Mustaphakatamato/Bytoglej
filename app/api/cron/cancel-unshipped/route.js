import { NextResponse } from 'next/server';
import { getStripe, isStripePaymentIntentId } from '@/lib/stripe';
import { createServerClient } from '@/lib/supabase-server';
import { notify } from '@/lib/notify';

// Vercel Cron (daglig): håndterer forsendelses-ordrer der ikke er afsendt til tiden.
//  1. Påmindelse: sælger notificeres når fristen er inden for 2 dage.
//  2. Annullering: er fristen (5 hverdage, sat i finalizePurchase) overskredet
//     uden afsendelse (status stadig 'paid'), refunderes køber, varen genaktiveres,
//     og sælgeren får talt en manglende afsendelse. Beskyttet af CRON_SECRET.

export async function GET(req) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supa = createServerClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const soonIso = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

  let reminded = 0, cancelled = 0, refunded = 0, walletReleased = 0;

  // ── 0. Forladte wallet-reservationer: pending-ordrer der aldrig blev betalt ──
  // (saldo blev reserveret ved checkout, men betalingen blev aldrig gennemført).
  // Efter 2 timer føres saldoen tilbage og ordren annulleres.
  const staleIso = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const { data: abandoned } = await supa.from('orders')
    .select('id, buyer_institution_id, wallet_applied')
    .eq('status', 'pending')
    .gt('wallet_applied', 0)
    .lt('created_at', staleIso);
  for (const o of (abandoned || [])) {
    const { data: claimed } = await supa.from('orders')
      .update({ status: 'cancelled' }).eq('id', o.id).eq('status', 'pending')
      .select('id').maybeSingle();
    if (!claimed) continue;
    if (o.buyer_institution_id) {
      await supa.rpc('wallet_credit', {
        _inst: o.buyer_institution_id, _amount: Number(o.wallet_applied), _type: 'refund_credit',
        _ref_type: 'order', _ref_id: o.id, _note: 'Betaling ikke gennemført — saldo ført tilbage',
      }).then(({ error }) => { if (error) console.error('[cancel-unshipped] wallet-release fejl:', error.message); });
      walletReleased++;
    }
  }

  // ── 1. Påmindelser (frist inden for 2 dage, endnu ikke sendt) ──────────
  const { data: soon } = await supa.from('orders')
    .select('id, order_groups, ship_by, order_number')
    .eq('status', 'paid')
    .eq('ship_reminder_sent', false)
    .not('ship_by', 'is', null)
    .gte('ship_by', nowIso)
    .lte('ship_by', soonIso);

  for (const o of (soon || [])) {
    const sellerInsts = [...new Set((o.order_groups || []).map(g => g.sellerInstitutionId).filter(Boolean))];
    for (const instId of sellerInsts) {
      try {
        await notify(supa, {
          institutionId: instId,
          type: 'order_ship_reminder',
          title: '⏰ Husk at sende din pakke',
          body: 'En betalt ordre skal afsendes snart. Sender du ikke inden fristen, annulleres handlen automatisk.',
          data: { order_id: o.id },
          url: '/mine-opgaver',
        });
      } catch (e) { console.error('[cancel-unshipped] påmindelse fejl:', e?.message); }
    }
    await supa.from('orders').update({ ship_reminder_sent: true }).eq('id', o.id);
    reminded++;
  }

  // ── 2. Annullering (frist overskredet, stadig ikke afsendt) ────────────
  const { data: overdue } = await supa.from('orders')
    .select('*')
    .eq('status', 'paid')
    .not('ship_by', 'is', null)
    .lt('ship_by', nowIso);

  const stripe = getStripe();

  for (const o of (overdue || [])) {
    // Atomisk claim: markér cancelled så to samtidige cron-kørsler ikke dobbelt-refunderer.
    const { data: claimed } = await supa.from('orders')
      .update({ status: 'cancelled' })
      .eq('id', o.id)
      .eq('status', 'paid')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    // Refundér: wallet-andel tilbage til saldo + kort-andel via Stripe.
    if (Number(o.wallet_applied) > 0 && o.buyer_institution_id) {
      try {
        await supa.rpc('wallet_credit', {
          _inst: o.buyer_institution_id, _amount: Number(o.wallet_applied), _type: 'refund_credit',
          _ref_type: 'order', _ref_id: o.id, _note: 'Handel annulleret — ikke afsendt til tiden',
        });
      } catch (e) { console.error('[cancel-unshipped] wallet-refusion fejl:', e?.message); }
    }
    // Kun ægte Stripe-betalinger refunderes her — wallet-ordrer har et syntetisk
    // `wallet_…`-id og er allerede ført tilbage til saldoen ovenfor.
    if (isStripePaymentIntentId(o.payment_intent_id)) {
      try {
        await stripe.refunds.create({ payment_intent: o.payment_intent_id });
        refunded++;
      } catch (e) { console.error('[cancel-unshipped] Stripe-refusion fejl:', e?.message); }
    }

    // Genaktivér varerne, så de kan sælges igen.
    const listingIds = (o.order_groups || []).flatMap(g => (g.items || []).map(i => i.listingId)).filter(Boolean);
    if (listingIds.length) {
      await supa.from('listings').update({
        is_sold: false, is_active: true, sold_at: null, sold_to: null, sold_to_institution_id: null,
      }).in('id', listingIds);
    }

    // Tæl manglende afsendelse pr. sælger (flag til senere håndhævelse).
    const sellerInsts = [...new Set((o.order_groups || []).map(g => g.sellerInstitutionId).filter(Boolean))];
    for (const instId of sellerInsts) {
      const { data: inst } = await supa.from('institutions').select('ship_fail_count').eq('id', instId).maybeSingle();
      await supa.from('institutions').update({ ship_fail_count: (inst?.ship_fail_count || 0) + 1 }).eq('id', instId);
      try {
        await notify(supa, {
          institutionId: instId,
          type: 'order_cancelled_unshipped',
          title: 'Handel annulleret — ikke afsendt',
          body: 'En betalt ordre blev annulleret, fordi den ikke blev afsendt inden fristen. Køberen er refunderet.',
          data: { order_id: o.id },
          url: '/mine-opgaver',
        });
      } catch (e) { console.error('[cancel-unshipped] sælger-notify fejl:', e?.message); }
    }

    // Besked til køber (chat + notifikation).
    const convId = (o.order_groups || []).map(g => g.conversationId).find(Boolean) || await findConversationId(supa, o.id);
    if (convId) {
      const msg = '⏰ Handlen blev annulleret, fordi varen ikke blev afsendt inden fristen. Beløbet er refunderet.';
      await supa.from('chat_messages').insert({ conversation_id: convId, sender_id: o.buyer_id, sender_name: 'System', content: msg });
      await supa.from('conversations').update({ last_message: msg, last_message_at: nowIso, initiator_unread: 1 }).eq('id', convId);
    }
    if (o.buyer_institution_id) {
      try {
        await notify(supa, {
          institutionId: o.buyer_institution_id,
          type: 'order_refunded',
          title: '↩️ Din ordre blev refunderet',
          body: 'Sælgeren nåede ikke at sende inden fristen, så handlen er annulleret og beløbet refunderet.',
          data: { order_id: o.id },
          url: '/mine-ordrer',
        });
      } catch (e) { console.error('[cancel-unshipped] køber-notify fejl:', e?.message); }
    }
    cancelled++;
  }

  return NextResponse.json({ ok: true, reminded, cancelled, refunded, walletReleased });
}

async function findConversationId(supa, orderId) {
  const { data: msgs } = await supa.from('chat_messages')
    .select('conversation_id')
    .eq('message_type', 'payment_confirmed')
    .ilike('content', `%"orderId":"${orderId}"%`)
    .limit(1);
  return msgs?.[0]?.conversation_id || null;
}
