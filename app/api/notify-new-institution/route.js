import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { institutionName, contactName, email, cvr, instType, city } = await req.json();
    const to = process.env.ADMIN_NOTIFICATION_EMAIL || 'mustaphakatamato@gmail.com';
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true });

    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'byt&leg <noreply@bytogleg.dk>',
        to: [to],
        subject: `[Ny ansøgning] ${institutionName}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
          <h2 style="color:#1B4332;">Ny institution afventer godkendelse</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#6B7570;width:130px;">Institution</td><td style="padding:6px 0;font-weight:600;">${institutionName}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7570;">Kontaktperson</td><td style="padding:6px 0;">${contactName || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7570;">E-mail</td><td style="padding:6px 0;">${email}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7570;">CVR/P-nr</td><td style="padding:6px 0;">${cvr || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7570;">Type</td><td style="padding:6px 0;">${instType || '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7570;">By</td><td style="padding:6px 0;">${city || '—'}</td></tr>
          </table>
          <div style="margin-top:24px;">
            <a href="${base}/admin" style="display:inline-block;background:#2D6A4F;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:99px;">Gå til admin →</a>
          </div>
        </div>`,
      }),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
