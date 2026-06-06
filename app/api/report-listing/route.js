import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = 'mustaphakatamato@live.dk';

export async function POST(req) {
  try {
    const { listingId, listingTitle, reason, note, reporterName } = await req.json();
    if (!listingId || !reason) return NextResponse.json({ error: 'Mangler data' }, { status: 400 });

    await resend.emails.send({
      from: 'byt&leg <noreply@bytogleg.dk>',
      to: ADMIN_EMAIL,
      subject: `Rapporteret opslag: ${listingTitle || listingId}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#133F2B">Opslag rapporteret</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#666;width:140px">Opslag ID</td><td style="padding:8px 0;font-weight:600">${listingId}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Titel</td><td style="padding:8px 0;font-weight:600">${listingTitle || '—'}</td></tr>
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
    console.error('report-listing error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
