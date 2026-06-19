import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

// Vercel Cron: runs on the 1st of each month at 08:00 UTC
// Schedule defined in vercel.json: "0 8 1 * *"
// Protected by CRON_SECRET env var

export async function GET(req) {
  // Fail closed: uden konfigureret CRON_SECRET må endpointet ikke kunne kaldes.
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supa = createServerClient();
  const now = new Date();
  // Invoice period: previous calendar month
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
  const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // end of current month

  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  try {
    // Find all institutions with shipping activity in the period
    const { data: shipments } = await supa.from('shipments')
      .select('id,seller_institution_id,cost_dkk,markup_dkk,total_charged_to_seller_dkk,tracking_number,booked_at,conversation_id,conversations(listing_title)')
      .not('seller_institution_id', 'is', null)
      .eq('status', 'delivered')
      .gte('delivered_at', periodStartStr)
      .lte('delivered_at', periodEndStr + 'T23:59:59Z');

    if (!shipments?.length) {
      return NextResponse.json({ ok: true, invoices_created: 0, message: 'No delivered shipments in period' });
    }

    // Group by seller institution
    const byInst = {};
    for (const s of shipments) {
      const instId = s.seller_institution_id;
      if (!byInst[instId]) byInst[instId] = [];
      byInst[instId].push(s);
    }

    let invoicesCreated = 0;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';

    for (const [instId, instShipments] of Object.entries(byInst)) {
      // Check if invoice already exists for this period
      const { data: existing } = await supa.from('shipping_invoices')
        .select('id')
        .eq('institution_id', instId)
        .eq('period_start', periodStartStr)
        .eq('period_end', periodEndStr)
        .maybeSingle();
      if (existing) continue;

      const { data: inst } = await supa.from('institutions')
        .select('id,name,email')
        .eq('id', instId)
        .maybeSingle();
      if (!inst) continue;

      const totalAmount = instShipments.reduce((s, r) => s + Number(r.total_charged_to_seller_dkk || r.cost_dkk || 0), 0);
      const invoiceNumber = `BL-SHIP-${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}-${instId.slice(0, 6).toUpperCase()}`;

      // Build HTML invoice
      const html = buildInvoiceHtml({ inst, instShipments, invoiceNumber, periodStartStr, periodEndStr, dueDateStr, totalAmount, baseUrl });

      // Insert invoice
      const { data: invoice } = await supa.from('shipping_invoices').insert({
        institution_id: instId,
        invoice_number: invoiceNumber,
        period_start: periodStartStr,
        period_end: periodEndStr,
        total_amount_dkk: totalAmount,
        status: 'sent',
        due_date: dueDateStr,
        html_url: null,
        sent_at: new Date().toISOString(),
      }).select().single();

      if (!invoice) continue;

      // Insert invoice lines
      const lines = instShipments.map(s => ({
        shipping_invoice_id: invoice.id,
        shipment_id: s.id,
        description: `Forsendelse: ${s.conversations?.listing_title || s.tracking_number || s.id}`,
        amount_dkk: Number(s.total_charged_to_seller_dkk || s.cost_dkk || 0),
        shipment_date: (s.booked_at || new Date().toISOString()).slice(0, 10),
        tracking_number: s.tracking_number,
      }));
      await supa.from('shipping_invoice_lines').insert(lines);

      // Reset institution balance for the period
      await supa.from('institutions').update({ shipping_current_balance_dkk: 0 }).eq('id', instId);

      // Email invoice
      if (inst.email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'byt&leg <noreply@bytogleg.dk>',
            to: [inst.email],
            subject: `Faktura for forsendelser: ${invoiceNumber}`,
            html,
          }),
        }).catch(() => {});
      }

      invoicesCreated++;
    }

    return NextResponse.json({ ok: true, invoices_created: invoicesCreated });
  } catch (e) {
    console.error('generate-shipping-invoices error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function buildInvoiceHtml({ inst, instShipments, invoiceNumber, periodStartStr, periodEndStr, dueDateStr, totalAmount, baseUrl }) {
  const rows = instShipments.map(s => `
    <tr>
      <td style="padding:10px 0;font-size:13px;color:#3A473D;border-bottom:1px solid #ECE6DA;">${(s.booked_at||'').slice(0,10)}</td>
      <td style="padding:10px 0;font-size:13px;color:#16221C;border-bottom:1px solid #ECE6DA;">${s.conversations?.listing_title || '—'}</td>
      <td style="padding:10px 0;font-size:13px;color:#6B7570;border-bottom:1px solid #ECE6DA;">${s.tracking_number || '—'}</td>
      <td style="padding:10px 0;font-size:13px;font-weight:700;color:#16221C;text-align:right;border-bottom:1px solid #ECE6DA;">${Number(s.total_charged_to_seller_dkk || s.cost_dkk || 0).toFixed(2)} kr.</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:640px;margin:48px auto 32px;background:#FDFAF4;border-radius:20px;overflow:hidden;border:1px solid rgba(22,34,28,0.08);">
    <div style="background:linear-gradient(160deg,#1B4332 0%,#2A7D4F 100%);padding:40px;display:flex;align-items:center;justify-content:space-between;">
      <span style="display:inline-block;background:rgba(255,255,255,0.13);border-radius:14px;padding:10px 22px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.04em;">byt<span style="opacity:0.6">&amp;</span>leg.</span>
      <span style="color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;">FAKTURA</span>
    </div>
    <div style="padding:40px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="font-size:12px;color:#6B7570;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Til</div>
          <div style="font-size:16px;font-weight:700;color:#16221C;">${inst.name}</div>
          <div style="font-size:13px;color:#3A473D;">${inst.email}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:#6B7570;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Fakturanummer</div>
          <div style="font-size:14px;font-weight:700;color:#16221C;">${invoiceNumber}</div>
          <div style="font-size:12px;color:#6B7570;margin-top:8px;">Periode: ${periodStartStr} – ${periodEndStr}</div>
          <div style="font-size:12px;color:#e11d48;font-weight:600;">Forfaldsdato: ${dueDateStr}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;font-size:11px;color:#6B7570;font-weight:700;padding-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #DAD3C4;">Dato</th>
            <th style="text-align:left;font-size:11px;color:#6B7570;font-weight:700;padding-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #DAD3C4;">Opslag</th>
            <th style="text-align:left;font-size:11px;color:#6B7570;font-weight:700;padding-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #DAD3C4;">Tracking</th>
            <th style="text-align:right;font-size:11px;color:#6B7570;font-weight:700;padding-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #DAD3C4;">Beløb</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:24px;padding-top:16px;border-top:2px solid #16221C;">
        <div style="text-align:right;">
          <div style="font-size:12px;color:#6B7570;margin-bottom:4px;">Total inkl. moms</div>
          <div style="font-size:24px;font-weight:800;color:#16221C;">${totalAmount.toFixed(2)} kr.</div>
        </div>
      </div>
      <div style="background:#F0FDF4;border-radius:14px;padding:16px 20px;margin-top:28px;">
        <div style="font-size:13px;color:#3A473D;line-height:1.6;">
          Betaling sendes til: <strong>byt&amp;leg ApS</strong><br>
          Reg.nr. / Kontonr.: Kontakt <a href="mailto:support@bytogleg.dk" style="color:#2A7D4F;">support@bytogleg.dk</a> for betalingsoplysninger
        </div>
      </div>
    </div>
    <div style="background:#F6F2EA;padding:20px 40px;border-top:1px solid rgba(22,34,28,0.06);text-align:center;">
      <p style="font-size:12px;color:#6B7570;margin:0;">byt&amp;leg &middot; <a href="${baseUrl}" style="color:#2A7D4F;text-decoration:none;">bytogleg.dk</a> &middot; <a href="mailto:support@bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">support@bytogleg.dk</a></p>
    </div>
  </div>
</body>
</html>`;
}
