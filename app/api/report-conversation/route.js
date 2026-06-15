import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { escapeHtml } from '@/lib/escape-html';

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'mustaphakatamato@live.dk';

// Rapporterer en samtale til byt&leg admin via e-mail.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const body = await req.json();
    const conversationId = escapeHtml(String(body.conversationId || '').slice(0, 100));
    const otherParty = escapeHtml(String(body.otherParty || '').slice(0, 200));
    const listingTitle = escapeHtml(String(body.listingTitle || '').slice(0, 200));
    const reason = escapeHtml(String(body.reason || '').slice(0, 200));
    const note = escapeHtml(String(body.note || '').slice(0, 2000));
    const reporterName = escapeHtml(String(body.reporterName || user.email || '').slice(0, 200));
    if (!conversationId || !reason) return NextResponse.json({ error: 'Mangler data' }, { status: 400 });

    await resend.emails.send({
      from: 'byt&leg <noreply@bytogleg.dk>',
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `Rapporteret samtale: ${otherParty || conversationId}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#133F2B">Samtale rapporteret</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#666;width:140px">Samtale ID</td><td style="padding:8px 0;font-weight:600">${conversationId}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Modpart</td><td style="padding:8px 0;font-weight:600">${otherParty || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Opslag</td><td style="padding:8px 0;font-weight:600">${listingTitle || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Årsag</td><td style="padding:8px 0;font-weight:600;color:#e11d48">${reason}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Rapporteret af</td><td style="padding:8px 0">${reporterName || 'Ukendt'}</td></tr>
            ${note ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top">Note</td><td style="padding:8px 0">${note}</td></tr>` : ''}
          </table>
          <a href="https://bytogleg.dk/admin" style="display:inline-block;margin-top:20px;background:#133F2B;color:#fff;padding:10px 24px;border-radius:99px;text-decoration:none;font-weight:700">Gå til admin →</a>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('report-conversation error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
