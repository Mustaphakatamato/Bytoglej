import { NextResponse } from 'next/server';
import { escapeHtml } from '@/lib/escape-html';
import { brandedEmail } from '@/lib/email-template';

export async function POST(req) {
  try {
    // Kaldes under signup (før login) — derfor ingen auth, men alt input
    // escapes og begrænses, da det kun videresendes til admin-mailen.
    const body = await req.json();
    const institutionName = escapeHtml(String(body.institutionName || '').slice(0, 200));
    const contactName = escapeHtml(String(body.contactName || '').slice(0, 200));
    const email = escapeHtml(String(body.email || '').slice(0, 200));
    const cvr = escapeHtml(String(body.cvr || '').slice(0, 50));
    const instType = escapeHtml(String(body.instType || '').slice(0, 100));
    const city = escapeHtml(String(body.city || '').slice(0, 100));
    if (!institutionName) return NextResponse.json({ ok: true });

    const to = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@bytogleg.dk';
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true });

    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'byt&leg <noreply@bytogleg.dk>',
        to: [to],
        subject: `[Ny ansøgning] ${institutionName}`,
        html: brandedEmail({
          heading: 'Ny institution afventer godkendelse',
          bodyHtml: `
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#6B7570;width:130px;">Institution</td><td style="padding:6px 0;font-weight:600;">${institutionName}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7570;">Kontaktperson</td><td style="padding:6px 0;">${contactName || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7570;">E-mail</td><td style="padding:6px 0;">${email}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7570;">CVR/P-nr</td><td style="padding:6px 0;">${cvr || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7570;">Type</td><td style="padding:6px 0;">${instType || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7570;">By</td><td style="padding:6px 0;">${city || '—'}</td></tr>
          </table>`,
          ctaText: 'Gå til admin',
          ctaUrl: `${base}/admin`,
        }),
      }),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
