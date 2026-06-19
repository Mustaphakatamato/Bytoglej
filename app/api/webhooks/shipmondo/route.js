import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { handleWebhook } from '@/lib/shipmondo/client';

export async function POST(req) {
  const supa = createServerClient();
  try {
    const signature = req.headers.get('x-shipmondo-hmac-sha256') || '';
    const secret = process.env.SHIPMONDO_WEBHOOK_SECRET || '';
    const payload = await req.json();

    let event;
    try {
      event = handleWebhook({ payload, signature, secret });
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }

    const { event_type, shipmondo_shipment_id, tracking_number } = event;

    // Idempotency: look up shipment by shipmondo_shipment_id
    const { data: shipment } = await supa.from('shipments')
      .select('id,status,conversation_id')
      .eq('shipmondo_shipment_id', shipmondo_shipment_id)
      .maybeSingle();

    if (!shipment) {
      // Unknown shipment — acknowledge but do nothing
      return NextResponse.json({ ok: true, skipped: true });
    }

    const statusMap = {
      'shipment.booked':      { status: 'booked',     col: 'booked_at' },
      'shipment.printed':     { status: 'printed',    col: 'printed_at' },
      'shipment.in_transit':  { status: 'in_transit', col: 'shipped_at' },
      'shipment.delivered':   { status: 'delivered',  col: 'delivered_at' },
      'shipment.failed':      { status: 'failed',     col: null },
    };

    const mapped = statusMap[event_type];
    if (!mapped) return NextResponse.json({ ok: true, unknown_event: event_type });

    // Idempotency: skip if we already have a later status
    const statusOrder = ['pending','booked','printed','in_transit','delivered','failed','cancelled'];
    const currentIdx = statusOrder.indexOf(shipment.status);
    const newIdx = statusOrder.indexOf(mapped.status);
    if (newIdx <= currentIdx && mapped.status !== 'failed') {
      return NextResponse.json({ ok: true, already_processed: true });
    }

    // Update shipment
    const shipmentUpdate = { status: mapped.status, updated_at: new Date().toISOString() };
    if (mapped.col) shipmentUpdate[mapped.col] = new Date().toISOString();
    await supa.from('shipments').update(shipmentUpdate).eq('id', shipment.id);

    // Update conversation delivery_status
    if (shipment.conversation_id) {
      const deliveryStatus = mapped.status === 'delivered' ? 'completed' : 'in_progress';
      await supa.from('conversations').update({ delivery_status: deliveryStatus }).eq('id', shipment.conversation_id);

      // Notify buyer on delivery
      if (mapped.status === 'delivered') {
        const { data: conv } = await supa.from('conversations')
          .select('initiator_institution_id,owner_name,listing_title')
          .eq('id', shipment.conversation_id)
          .maybeSingle();
        if (conv?.initiator_institution_id) {
          const { data: buyerInst } = await supa.from('institutions')
            .select('email,name')
            .eq('id', conv.initiator_institution_id)
            .maybeSingle();
          if (buyerInst?.email) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'byt&leg <noreply@bytogleg.dk>',
                to: [buyerInst.email],
                subject: `Din pakke er leveret: ${conv.listing_title || 'byt&leg'}`,
                html: deliveredEmailHtml({ buyerName: buyerInst.name, listingTitle: conv.listing_title, baseUrl }),
              }),
            }).catch(() => {});
          }
        }
      }
    }

    return NextResponse.json({ ok: true, processed: event_type });
  } catch (e) {
    console.error('shipmondo-webhook error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function deliveredEmailHtml({ buyerName, listingTitle, baseUrl }) {
  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:48px auto 32px;background:#FDFAF4;border-radius:20px;overflow:hidden;border:1px solid rgba(22,34,28,0.08);">
    <div style="background:linear-gradient(160deg,#1B4332 0%,#2A7D4F 100%);padding:40px;text-align:center;">
      <span style="display:inline-block;background:rgba(255,255,255,0.13);border-radius:14px;padding:10px 22px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.04em;">byt<span style="opacity:0.6">&amp;</span>leg.</span>
    </div>
    <div style="padding:40px;">
      <h1 style="font-size:22px;font-weight:800;color:#16221C;margin:0 0 16px;">Pakke leveret! 🎉</h1>
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 24px;">
        Hej ${buyerName || 'jer'},<br><br>
        Din pakke med <strong>${listingTitle || 'dit legetøj'}</strong> er nu leveret. God fornøjelse!
      </p>
      <div style="text-align:center;">
        <a href="${baseUrl}/beskeder" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:99px;">Se din handel →</a>
      </div>
    </div>
    <div style="background:#F6F2EA;padding:20px 40px;border-top:1px solid rgba(22,34,28,0.06);text-align:center;">
      <p style="font-size:12px;color:#6B7570;margin:0;">byt&amp;leg &middot; <a href="${baseUrl}" style="color:#2A7D4F;text-decoration:none;">bytogleg.dk</a></p>
    </div>
  </div>
</body>
</html>`;
}
