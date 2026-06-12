import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createShipment } from '@/lib/shipmondo/client';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { escapeHtml } from '@/lib/escape-html';

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();
  try {
    const { conversation_id, listing_id, delivery_method, buyer_name, seller_name } = await req.json();
    if (!conversation_id) return NextResponse.json({ error: 'Mangler conversation_id' }, { status: 400 });
    if (delivery_method !== 'shipping') return NextResponse.json({ ok: true, skipped: true });

    // Load conversation + institutions
    const { data: conv } = await supa.from('conversations')
      .select('id,listing_id,owner_id,initiator_id,owner_institution_id,initiator_institution_id,owner_name,initiator_name,shipment_id')
      .eq('id', conversation_id)
      .maybeSingle();
    if (!conv) return NextResponse.json({ error: 'Samtale ikke fundet' }, { status: 404 });

    // Authorization: caller must be a participant in the conversation
    // (direct user match, or member of one of the two institutions).
    let isParticipant = conv.owner_id === user.id || conv.initiator_id === user.id;
    if (!isParticipant) {
      const instIds = [conv.owner_institution_id, conv.initiator_institution_id].filter(Boolean);
      if (instIds.length && user.email) {
        const [{ data: insts }, { data: mems }] = await Promise.all([
          supa.from('institutions').select('id,email,leader_email').in('id', instIds),
          supa.from('institution_members').select('institution_id').in('institution_id', instIds).ilike('email', user.email),
        ]);
        const emailLc = user.email.toLowerCase();
        isParticipant =
          (insts || []).some(i => [i.email, i.leader_email].filter(Boolean).some(e => e.toLowerCase() === emailLc)) ||
          (mems || []).length > 0;
      }
    }
    if (!isParticipant) {
      return NextResponse.json({ error: 'Du har ikke adgang til denne samtale' }, { status: 403 });
    }

    // Idempotens: book ikke dobbelt for samme samtale
    if (conv.shipment_id) {
      const { data: existing } = await supa.from('shipments')
        .select('id,tracking_number,tracking_url')
        .eq('id', conv.shipment_id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ ok: true, already_booked: true, shipment_id: existing.id, tracking_number: existing.tracking_number, tracking_url: existing.tracking_url });
      }
    }

    const effectiveListingId = listing_id || conv.listing_id;

    // Load seller institution
    const { data: sellerInst } = await supa.from('institutions')
      .select('id,name,address,zipcode,city,email,phone,shipping_billing_enabled,shipping_credit_limit_dkk,shipping_current_balance_dkk')
      .eq('id', conv.owner_institution_id)
      .maybeSingle();

    // Load buyer institution
    const { data: buyerInst } = await supa.from('institutions')
      .select('id,name,address,zipcode,city,email,phone')
      .eq('id', conv.initiator_institution_id)
      .maybeSingle();

    // Load shipping options
    const { data: so } = await supa.from('shipping_options')
      .select('*')
      .eq('listing_id', effectiveListingId)
      .maybeSingle();

    const carrier = 'postnord';
    const service_type = 'service_point';
    const size_category = so?.shipping_size_category || 'medium';

    // Credit limit check for seller
    if (sellerInst) {
      const creditLimit = Number(sellerInst.shipping_credit_limit_dkk || 500);
      const currentBalance = Number(sellerInst.shipping_current_balance_dkk || 0);
      if (currentBalance >= creditLimit) {
        return NextResponse.json({ error: 'Kreditgrænse nået — kontakt support for at øge grænsen', code: 'credit_limit' }, { status: 402 });
      }
    }

    // Book shipment (mock or real depending on SHIPMONDO_API_KEY)
    const shipmentResult = await createShipment({
      sender: {
        name: sellerInst?.name || conv.owner_name || seller_name || 'Sælger',
        address: sellerInst?.address || '',
        zip_code: sellerInst?.zipcode || '8000',
        city: sellerInst?.city || '',
        country_code: 'DK',
        email: sellerInst?.email || '',
        phone: sellerInst?.phone || '',
      },
      receiver: {
        name: buyerInst?.name || conv.initiator_name || buyer_name || 'Køber',
        address: buyerInst?.address || '',
        zip_code: buyerInst?.zipcode || '2100',
        city: buyerInst?.city || '',
        country_code: 'DK',
        email: buyerInst?.email || '',
        phone: buyerInst?.phone || '',
      },
      carrier,
      service_type,
      size_category,
      reference: conversation_id,
    });

    // Insert into shipments table
    const { data: shipment, error: shipErr } = await supa.from('shipments').insert({
      conversation_id,
      seller_institution_id: sellerInst?.id || conv.owner_institution_id || null,
      buyer_institution_id: buyerInst?.id || conv.initiator_institution_id || null,
      shipmondo_shipment_id: shipmentResult.shipmondo_shipment_id,
      carrier,
      service_type,
      size_category,
      cost_dkk: shipmentResult.price_dkk,
      markup_dkk: 0,
      total_charged_to_seller_dkk: shipmentResult.price_dkk,
      tracking_number: shipmentResult.tracking_number,
      tracking_url: shipmentResult.tracking_url,
      label_pdf_url: shipmentResult.label_pdf_url,
      status: 'booked',
      booked_at: new Date().toISOString(),
    }).select().single();

    if (shipErr) throw new Error(shipErr.message);

    // Update conversation
    await supa.from('conversations').update({
      delivery_method: 'shipping',
      delivery_status: 'in_progress',
      shipment_id: shipment.id,
    }).eq('id', conversation_id);

    // Update seller's running balance
    if (sellerInst && shipmentResult.price_dkk) {
      await supa.from('institutions').update({
        shipping_current_balance_dkk: Number(sellerInst.shipping_current_balance_dkk || 0) + Number(shipmentResult.price_dkk),
      }).eq('id', sellerInst.id);
    }

    // Notify seller by email
    if (sellerInst?.email) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'byt&leg <noreply@bytogleg.dk>',
          to: [sellerInst.email],
          subject: 'Forsendelseslabel klar — din pakke er booket',
          html: shipmentEmailHtml({
            institutionName: sellerInst.name,
            trackingNumber: shipmentResult.tracking_number,
            trackingUrl: shipmentResult.tracking_url,
            labelPdfUrl: shipmentResult.label_pdf_url,
            baseUrl,
          }),
        }),
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      shipment_id: shipment.id,
      tracking_number: shipmentResult.tracking_number,
      tracking_url: shipmentResult.tracking_url,
    });
  } catch (e) {
    console.error('book-shipment error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function shipmentEmailHtml({ institutionName, trackingNumber, trackingUrl, labelPdfUrl, baseUrl }) {
  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:48px auto 32px;background:#FDFAF4;border-radius:20px;overflow:hidden;border:1px solid rgba(22,34,28,0.08);">
    <div style="background:linear-gradient(160deg,#1B4332 0%,#2A7D4F 100%);padding:40px;text-align:center;">
      <span style="display:inline-block;background:rgba(255,255,255,0.13);border-radius:14px;padding:10px 22px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.04em;">byt<span style="opacity:0.6">&amp;</span>leg.</span>
    </div>
    <div style="padding:40px;">
      <h1 style="font-size:22px;font-weight:800;color:#16221C;margin:0 0 16px;">Forsendelse booket 📦</h1>
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 24px;">Hej ${escapeHtml(institutionName)},<br><br>Forsendelsen er nu booket. Print labelen og klæb den på pakken.</p>
      <div style="background:#F0FDF4;border-radius:14px;padding:16px 20px;margin-bottom:28px;">
        <div style="font-size:12px;color:#16a34a;font-weight:700;margin-bottom:4px;">TRACKINGNUMMER</div>
        <div style="font-size:18px;font-weight:800;color:#16221C;letter-spacing:0.05em;">${trackingNumber || '—'}</div>
      </div>
      <div style="text-align:center;margin-bottom:20px;">
        ${labelPdfUrl ? `<a href="${labelPdfUrl}" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:99px;">Print forsendelseslabel →</a>` : ''}
      </div>
      ${trackingUrl ? `<p style="font-size:13px;color:#6B7570;text-align:center;"><a href="${trackingUrl}" style="color:#2A7D4F;">Følg pakken →</a></p>` : ''}
    </div>
    <div style="background:#F6F2EA;padding:20px 40px;border-top:1px solid rgba(22,34,28,0.06);text-align:center;">
      <p style="font-size:12px;color:#6B7570;margin:0;">byt&amp;leg &middot; <a href="${baseUrl}" style="color:#2A7D4F;text-decoration:none;">bytogleg.dk</a></p>
    </div>
  </div>
</body>
</html>`;
}
